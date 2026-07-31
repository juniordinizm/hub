import "server-only";
import type { Pool } from "pg";
import type { AsaasGateway } from "./asaas";
import { AsaasGatewayError } from "./asaas-client";
import {
  type AsaasFinancialCorrelation,
  decideAsaasFinancialEvent,
  parseAsaasWebhookEnvelope,
} from "./asaas-financial-events";
import { parseAsaasDecimalToCents } from "./asaas-money";
import {
  AsaasWebhookProcessingError,
  type ClaimedAsaasWebhookEvent,
} from "./asaas-webhook-worker";
import { type BuyerIdentity, parseBuyerIdentity } from "./buyer-identity";

type AsaasCustomerGateway = Pick<AsaasGateway, "getCustomer">;
type AsaasCustomerQueryClient = Pick<Pool, "query">;

export type AsaasBuyerIdentityPreparation =
  | { kind: "not_required" }
  | {
      customerId: string;
      identity: BuyerIdentity;
      kind: "resolved";
      orderId: string;
    }
  | {
      customerId: string | null;
      kind: "review_required";
      orderId: string;
      reason:
        | "buyer_identity_conflict"
        | "buyer_identity_invalid"
        | "buyer_identity_missing";
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRecord = (
  value: Record<string, unknown>,
  field: string
): Record<string, unknown> | null => {
  const nested = value[field];
  return isRecord(nested) ? nested : null;
};

const getNonEmptyString = (
  value: Record<string, unknown> | null,
  field: string
): string | null => {
  const candidate = value?.[field];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
};

interface GrantPreparationInput {
  correlation: AsaasFinancialCorrelation;
  payment: Record<string, unknown>;
}

const expectedGrantPaymentStatus = {
  PAYMENT_CONFIRMED: "CONFIRMED",
  PAYMENT_RECEIVED: "RECEIVED",
} as const;

const isMalformedOptionalIdentifier = (
  record: Record<string, unknown> | null,
  field: string
): boolean => {
  const value = record?.[field];
  return (
    value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim().length > 0)
  );
};

const getGrantPreparationInput = (
  event: ClaimedAsaasWebhookEvent
): GrantPreparationInput | null => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const envelope = parseAsaasWebhookEnvelope(event.payload);
  if (
    !envelope ||
    envelope.event !== event.eventName ||
    envelope.subject.kind !== "payment"
  ) {
    return null;
  }

  const expectedStatus =
    expectedGrantPaymentStatus[
      event.eventName as keyof typeof expectedGrantPaymentStatus
    ];
  if (!expectedStatus || envelope.subject.status !== expectedStatus) {
    return null;
  }

  const payment = getRecord(payload, "payment");
  if (!payment) {
    return null;
  }
  const amountInCents = parseAsaasDecimalToCents(payment.value);
  if (amountInCents === null) {
    return null;
  }

  const decision = decideAsaasFinancialEvent({
    payload: event.payload,
    snapshot: {
      amountInCents,
      checkoutStatus: "active",
      orderStatus: "pending",
      providerPaymentStatus: null,
      providerRiskStatus: null,
    },
  });
  const checkout = getRecord(payload, "checkout");
  if (
    decision.action !== "apply" ||
    decision.effect !== "grant" ||
    decision.reviewReason !== null ||
    isMalformedOptionalIdentifier(checkout, "externalReference") ||
    isMalformedOptionalIdentifier(checkout, "id") ||
    isMalformedOptionalIdentifier(payment, "checkoutSession") ||
    isMalformedOptionalIdentifier(payment, "externalReference")
  ) {
    return null;
  }

  const { correlation } = decision;
  const hasExternalReference = Boolean(
    correlation.checkoutExternalReference ||
      correlation.paymentExternalReference
  );
  if (
    correlation.hasConflictingExternalReferences ||
    (hasExternalReference && !correlation.localOrderId) ||
    (correlation.checkoutId &&
      correlation.paymentCheckoutSession &&
      correlation.checkoutId !== correlation.paymentCheckoutSession) ||
    (event.orderId &&
      correlation.localOrderId &&
      event.orderId.toLowerCase() !== correlation.localOrderId.toLowerCase())
  ) {
    return null;
  }

  return [
    correlation.checkoutExternalReference,
    correlation.paymentExternalReference,
    correlation.checkoutId,
    correlation.paymentCheckoutSession,
    correlation.paymentId,
  ].some(Boolean)
    ? { correlation, payment }
    : null;
};

interface CorrelatedOrder {
  buyerIdentityStatus: string;
  id: string;
}

const findCorrelatedOrders = async ({
  client,
  correlation,
  eventOrderId,
}: {
  client: AsaasCustomerQueryClient;
  correlation: AsaasFinancialCorrelation;
  eventOrderId: string | null;
}): Promise<CorrelatedOrder[]> => {
  const result = await client.query(
    `select distinct
       id,
       buyer_identity_status as "buyerIdentityStatus"
     from orders
     where provider = 'asaas'
       and ($1::uuid is null or id = $1)
       and ($2::text is null or external_id = $2)
       and ($3::text is null or external_id = $3)
       and ($4::text is null or provider_checkout_id = $4)
       and ($5::text is null or provider_checkout_id = $5)
       and (provider_payment_id is null or provider_payment_id = $6)
       and (
         ($2::text is not null and external_id = $2)
         or ($3::text is not null and external_id = $3)
         or ($4::text is not null and provider_checkout_id = $4)
         or ($5::text is not null and provider_checkout_id = $5)
         or ($6::text is not null and provider_payment_id = $6)
       )`,
    [
      eventOrderId,
      correlation.checkoutExternalReference,
      correlation.paymentExternalReference,
      correlation.checkoutId,
      correlation.paymentCheckoutSession,
      correlation.paymentId,
    ]
  );
  return [
    ...new Set(
      result.rows.flatMap((row) => {
        if (!isRecord(row)) {
          return [];
        }
        const buyerIdentityStatus = getNonEmptyString(
          row,
          "buyerIdentityStatus"
        );
        const id = getNonEmptyString(row, "id");
        return buyerIdentityStatus && id ? [{ buyerIdentityStatus, id }] : [];
      })
    ),
  ];
};

const createReviewPreparation = ({
  customerId,
  orderId,
  reason,
}: {
  customerId: string | null;
  orderId: string;
  reason:
    | "buyer_identity_conflict"
    | "buyer_identity_invalid"
    | "buyer_identity_missing";
}): AsaasBuyerIdentityPreparation => ({
  customerId,
  kind: "review_required",
  orderId,
  reason,
});

export const prepareAsaasBuyerIdentity = async ({
  client,
  event,
  gateway,
}: {
  client: AsaasCustomerQueryClient;
  event: ClaimedAsaasWebhookEvent;
  gateway: AsaasCustomerGateway;
}): Promise<AsaasBuyerIdentityPreparation> => {
  const grantInput = getGrantPreparationInput(event);
  if (!grantInput) {
    return { kind: "not_required" };
  }

  const correlatedOrders = await findCorrelatedOrders({
    client,
    correlation: grantInput.correlation,
    eventOrderId: event.orderId,
  });
  if (correlatedOrders.length !== 1) {
    return { kind: "not_required" };
  }
  const correlatedOrder = correlatedOrders[0];
  if (correlatedOrder?.buyerIdentityStatus !== "pending") {
    return { kind: "not_required" };
  }
  const { id: orderId } = correlatedOrder;

  const customerId = getNonEmptyString(grantInput.payment, "customer");
  if (!customerId) {
    return createReviewPreparation({
      customerId: null,
      orderId,
      reason: "buyer_identity_missing",
    });
  }

  try {
    const customer = await gateway.getCustomer(customerId);
    if (customer.id !== customerId) {
      return createReviewPreparation({
        customerId,
        orderId,
        reason: "buyer_identity_conflict",
      });
    }
    const identity = parseBuyerIdentity(customer);
    if (!identity) {
      return createReviewPreparation({
        customerId,
        orderId,
        reason: "buyer_identity_invalid",
      });
    }
    return { customerId, identity, kind: "resolved", orderId };
  } catch (error) {
    if (error instanceof AsaasGatewayError) {
      if (error.kind === "not_found") {
        return createReviewPreparation({
          customerId,
          orderId,
          reason: "buyer_identity_missing",
        });
      }
      if (error.kind === "invalid_response") {
        return createReviewPreparation({
          customerId,
          orderId,
          reason: "buyer_identity_invalid",
        });
      }
      throw new AsaasWebhookProcessingError(`asaas_customer_${error.kind}`, {
        retryable: error.retryable,
      });
    }
    throw new AsaasWebhookProcessingError("asaas_customer_lookup_failed", {
      retryable: true,
    });
  }
};
