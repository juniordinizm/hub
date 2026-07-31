import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  applyPaidWebhookAccess,
  applyPaymentRevocation,
} from "@/features/enrollments/server";
import {
  createAccountActivationMessage,
  createPaidAccessReleasedMessage,
} from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import type { AsaasGateway } from "./asaas";
import {
  type AsaasBuyerIdentityPreparation,
  prepareAsaasBuyerIdentity,
} from "./asaas-customer-enrichment";
import {
  type AsaasFinancialCorrelation,
  type AsaasFinancialEventDecision,
  type AsaasFinancialOrderSnapshot,
  type AsaasFinancialReviewReason,
  decideAsaasFinancialEvent,
} from "./asaas-financial-events";
import { parseAsaasDecimalToCents } from "./asaas-money";
import {
  AsaasWebhookProcessingError,
  type AsaasWebhookProcessor,
} from "./asaas-webhook-worker";
import {
  LocalOrderIdentityError,
  resolveLocalOrderIdentity,
} from "./order-identity";
import { getAsaasProviderClient } from "./provider";

interface CorrelationRow {
  id: string;
  matchKind: string;
}

interface LockedOrderRow {
  accessDurationMonths: number | null;
  amountInCents: number;
  buyerIdentityStatus: "pending" | "resolved" | "review_required";
  checkoutStatus: AsaasFinancialOrderSnapshot["checkoutStatus"];
  courseId: string;
  customerEmail: string | null;
  customerName: string | null;
  externalId: string;
  id: string;
  orderStatus: AsaasFinancialOrderSnapshot["orderStatus"];
  provider: string;
  providerCheckoutId: string | null;
  providerCustomerId: string | null;
  providerPaymentId: string | null;
  providerPaymentStatus: string | null;
  providerRiskStatus: string | null;
  userId: string | null;
}

interface ProcessorDependencies {
  applyPaidAccess: typeof applyPaidWebhookAccess;
  applyRevocation: typeof applyPaymentRevocation;
  enqueueMessage: typeof enqueueOutboxMessage;
  gateway: Pick<AsaasGateway, "getCustomer">;
  now: () => Date;
  prepareIdentity: (
    event: Parameters<AsaasWebhookProcessor["prepare"]>[0],
    gateway: Pick<AsaasGateway, "getCustomer">
  ) => Promise<AsaasBuyerIdentityPreparation>;
  resolveIdentity: typeof resolveLocalOrderIdentity;
}

const defaultDependencies: ProcessorDependencies = {
  applyPaidAccess: applyPaidWebhookAccess,
  applyRevocation: applyPaymentRevocation,
  enqueueMessage: enqueueOutboxMessage,
  gateway: {
    getCustomer: async (customerId) =>
      await getAsaasProviderClient().getCustomer(customerId),
  },
  now: () => new Date(),
  prepareIdentity: async (event, gateway) =>
    await prepareAsaasBuyerIdentity({ client: getPool(), event, gateway }),
  resolveIdentity: resolveLocalOrderIdentity,
};

const getField = (row: unknown, field: string): unknown => {
  if (!(row && typeof row === "object" && field in row)) {
    return;
  }
  return Reflect.get(row, field);
};

const getString = (row: unknown, field: string): string | null => {
  const value = getField(row, field);
  return typeof value === "string" && value.length > 0 ? value : null;
};

const getNullableString = (row: unknown, field: string): string | null => {
  const value = getField(row, field);
  return typeof value === "string" ? value : null;
};

const getNumber = (row: unknown, field: string): number | null => {
  const value = getField(row, field);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const hasExactPaymentAmount = ({
  expectedAmountInCents,
  payload,
}: {
  expectedAmountInCents: number;
  payload: unknown;
}): boolean =>
  parseAsaasDecimalToCents(getField(getField(payload, "payment"), "value")) ===
  expectedAmountInCents;

interface RefundEvidence {
  dateCreated: string;
  endToEndIdentifier: string | null;
  receiptUrl: string | null;
  status: string;
  valueInCents: number;
}

const getExactRefundEvidence = ({
  expectedAmountInCents,
  payload,
}: {
  expectedAmountInCents: number;
  payload: unknown;
}): RefundEvidence | null => {
  const refunds = getField(getField(payload, "payment"), "refunds");
  if (!Array.isArray(refunds)) {
    return null;
  }
  for (const refund of refunds) {
    const dateCreated = getString(refund, "dateCreated");
    const status = getString(refund, "status");
    const valueInCents = parseAsaasDecimalToCents(getField(refund, "value"));
    if (
      dateCreated &&
      status === "DONE" &&
      valueInCents === expectedAmountInCents
    ) {
      return {
        dateCreated,
        endToEndIdentifier: getNullableString(refund, "endToEndIdentifier"),
        receiptUrl: getNullableString(refund, "transactionReceiptUrl"),
        status,
        valueInCents,
      };
    }
  }
  return null;
};

const asCorrelationRow = (row: unknown): CorrelationRow | null => {
  const id = getString(row, "id");
  const matchKind = getString(row, "match_kind");
  return id && matchKind ? { id, matchKind } : null;
};

const orderStatuses = new Set([
  "cancelled",
  "disputed",
  "paid",
  "pending",
  "refunded",
]);
const checkoutStatuses = new Set([
  "active",
  "cancelled",
  "creating",
  "expired",
  "failed",
  "pending",
  "uncertain",
]);
const buyerIdentityStatuses = new Set([
  "pending",
  "resolved",
  "review_required",
]);

const asLockedOrder = (row: unknown): LockedOrderRow | null => {
  const id = getString(row, "id");
  const provider = getString(row, "provider");
  const externalId = getString(row, "external_id");
  const courseId = getString(row, "course_id");
  const amountInCents = getNumber(row, "amount_in_cents");
  const orderStatus = getString(row, "status");
  const checkoutStatus = getString(row, "checkout_status");
  const buyerIdentityStatus = getString(row, "buyer_identity_status");
  if (
    !(
      id &&
      provider &&
      externalId &&
      courseId &&
      amountInCents !== null &&
      orderStatus &&
      orderStatuses.has(orderStatus) &&
      checkoutStatus &&
      checkoutStatuses.has(checkoutStatus) &&
      buyerIdentityStatus &&
      buyerIdentityStatuses.has(buyerIdentityStatus)
    )
  ) {
    return null;
  }
  return {
    accessDurationMonths: getNumber(row, "access_duration_months"),
    amountInCents,
    buyerIdentityStatus:
      buyerIdentityStatus as LockedOrderRow["buyerIdentityStatus"],
    checkoutStatus:
      checkoutStatus as AsaasFinancialOrderSnapshot["checkoutStatus"],
    courseId,
    customerEmail: getNullableString(row, "customer_email"),
    customerName: getNullableString(row, "customer_name"),
    externalId,
    id,
    orderStatus: orderStatus as AsaasFinancialOrderSnapshot["orderStatus"],
    provider,
    providerCheckoutId: getNullableString(row, "provider_checkout_id"),
    providerCustomerId: getNullableString(row, "provider_customer_id"),
    providerPaymentId: getNullableString(row, "provider_payment_id"),
    providerPaymentStatus: getNullableString(row, "provider_payment_status"),
    providerRiskStatus: getNullableString(row, "provider_risk_status"),
    userId: getNullableString(row, "user_id"),
  };
};

const emptySnapshot: AsaasFinancialOrderSnapshot = {
  amountInCents: null,
  checkoutStatus: "pending",
  orderStatus: "pending",
  providerPaymentStatus: null,
  providerRiskStatus: null,
};

const insertSafeAlert = async ({
  client,
  eventId,
  reason,
}: {
  client: PoolClient;
  eventId: string;
  reason:
    | "ambiguous_identifiers"
    | "identifier_conflict"
    | "no_correlation"
    | "unknown_event";
}): Promise<void> => {
  await client.query(
    `insert into audit_logs (action, target_type, target_id, metadata)
     values (
       'asaas_webhook.correlation_alert',
       'webhook_event',
       $1,
       jsonb_build_object('reason', $2::text)
     )`,
    [eventId, reason]
  );
};

const findCorrelationRows = async ({
  client,
  correlation,
  existingOrderId,
}: {
  client: PoolClient;
  correlation: AsaasFinancialCorrelation;
  existingOrderId: string | null;
}): Promise<CorrelationRow[]> => {
  const result = await client.query(
    `with correlation_identifiers as (
       select id, 'event_order_id'::text as match_kind
       from orders
       where provider = 'asaas' and id = $1
       union all
       select id, 'checkout_external_reference'
       from orders
       where provider = 'asaas'
         and external_id = $2
       union all
       select id, 'payment_external_reference'
       from orders
       where provider = 'asaas'
         and external_id = $3
       union all
       select id, 'checkout_id'
       from orders
       where provider = 'asaas' and provider_checkout_id = $4
       union all
       select id, 'payment_checkout_session'
       from orders
       where provider = 'asaas' and provider_checkout_id = $5
       union all
       select id, 'provider_payment_id'
       from orders
       where provider = 'asaas' and provider_payment_id = $6
     )
     select id, match_kind
     from correlation_identifiers`,
    [
      existingOrderId,
      correlation.checkoutExternalReference,
      correlation.paymentExternalReference,
      correlation.checkoutId,
      correlation.paymentCheckoutSession,
      correlation.paymentId,
    ]
  );
  return result.rows
    .map(asCorrelationRow)
    .filter((row): row is CorrelationRow => row !== null);
};

const hasIdentifierConflict = ({
  correlation,
  order,
}: {
  correlation: AsaasFinancialCorrelation;
  order: LockedOrderRow;
}): boolean => {
  if (correlation.hasConflictingExternalReferences) {
    return true;
  }
  if (
    correlation.checkoutId &&
    correlation.paymentCheckoutSession &&
    correlation.checkoutId !== correlation.paymentCheckoutSession
  ) {
    return true;
  }
  if (
    (correlation.checkoutExternalReference ||
      correlation.paymentExternalReference) &&
    !correlation.localOrderId
  ) {
    return true;
  }
  if (
    correlation.localOrderId &&
    correlation.localOrderId.toLowerCase() !== order.id.toLowerCase()
  ) {
    return true;
  }
  if (
    (correlation.checkoutExternalReference &&
      correlation.checkoutExternalReference !== order.externalId) ||
    (correlation.paymentExternalReference &&
      correlation.paymentExternalReference !== order.externalId)
  ) {
    return true;
  }
  return false;
};

const loadLockedOrder = async ({
  client,
  orderId,
}: {
  client: PoolClient;
  orderId: string;
}): Promise<LockedOrderRow> => {
  const result = await client.query(
    `select
       id,
       provider,
       external_id,
       status,
       buyer_identity_status,
       checkout_status,
       provider_checkout_id,
       provider_customer_id,
       provider_payment_id,
       provider_payment_status,
       provider_risk_status,
       amount_in_cents,
       access_duration_months,
       course_id,
       user_id,
       customer_email,
       customer_name
     from orders
     where id = $1
     limit 1`,
    [orderId]
  );
  const order = asLockedOrder(result.rows[0]);
  if (!(order && order.provider === "asaas")) {
    throw new AsaasWebhookProcessingError("order_snapshot_invalid", {
      retryable: false,
    });
  }
  return order;
};

const associateWebhookEvent = async ({
  client,
  eventId,
  orderId,
}: {
  client: PoolClient;
  eventId: string;
  orderId: string;
}): Promise<void> => {
  const associated = await client.query(
    `update webhook_events
     set order_id = $2, updated_at = now()
     where id = $1 and (order_id is null or order_id = $2)
     returning id`,
    [eventId, orderId]
  );
  if (!getString(associated.rows[0], "id")) {
    throw new AsaasWebhookProcessingError("webhook_order_conflict", {
      retryable: false,
    });
  }
};

const insertReview = async ({
  client,
  eventId,
  orderId,
  reason,
  type,
}: {
  client: PoolClient;
  eventId: string;
  orderId: string;
  reason: AsaasFinancialReviewReason | BuyerIdentityReviewReason;
  type?: AsaasFinancialReviewReason | "buyer_identity";
}): Promise<void> => {
  const reviewType: AsaasFinancialReviewReason | "buyer_identity" =
    type ?? (reason as AsaasFinancialReviewReason);
  await client.query(
    `insert into payment_reviews (
       order_id,
       webhook_event_id,
       type,
       reason
     )
     values ($1, $2, $3::payment_review_type, $4)
     on conflict (webhook_event_id)
       where webhook_event_id is not null
       do nothing`,
    [orderId, eventId, reviewType, reason]
  );
};

type BuyerIdentityReviewReason =
  | "buyer_identity_conflict"
  | "buyer_identity_course_revoked"
  | "buyer_identity_invalid"
  | "buyer_identity_missing"
  | "buyer_identity_platform_blocked"
  | "buyer_identity_team_account";

const localIdentityReviewReasons: Record<
  LocalOrderIdentityError["code"],
  BuyerIdentityReviewReason
> = {
  buyer_identity_course_revoked: "buyer_identity_course_revoked",
  buyer_identity_platform_blocked: "buyer_identity_platform_blocked",
  buyer_identity_team_account: "buyer_identity_team_account",
  order_identity_conflict: "buyer_identity_conflict",
  order_identity_incomplete: "buyer_identity_invalid",
  order_user_not_found: "buyer_identity_invalid",
};

const openBuyerIdentityReview = async ({
  client,
  eventId,
  orderId,
  reason,
}: {
  client: PoolClient;
  eventId: string;
  orderId: string;
  reason: BuyerIdentityReviewReason;
}): Promise<void> => {
  await client.query(
    `update orders
     set buyer_identity_status = 'review_required',
         updated_at = now()
     where id = $1
       and buyer_identity_status in ('pending', 'resolved')`,
    [orderId]
  );
  await insertReview({
    client,
    eventId,
    orderId,
    reason,
    type: "buyer_identity",
  });
};

const getIncomingCheckoutId = (
  correlation: AsaasFinancialCorrelation
): string | null =>
  correlation.checkoutId ?? correlation.paymentCheckoutSession;

const persistDecision = async ({
  client,
  correlation,
  decision,
  orderId,
}: {
  client: PoolClient;
  correlation: AsaasFinancialCorrelation;
  decision: AsaasFinancialEventDecision;
  orderId: string;
}): Promise<boolean> => {
  const updates = decision.updates;
  const orderStatus = updates.orderStatus ?? null;
  const checkoutStatus = updates.checkoutStatus ?? null;
  const result = await client.query(
    `update orders
     set provider_checkout_id = coalesce(provider_checkout_id, $2::text),
         provider_payment_id = coalesce(provider_payment_id, $3::text),
         status = case when $4::boolean then $5::order_status else status end,
         checkout_status = case
           when $6::boolean then $7::checkout_status
           else checkout_status
         end,
         paid_amount_in_cents = case
           when $8::boolean then $9
           else paid_amount_in_cents
         end,
         payment_method = case
           when $10::boolean then $11
           else payment_method
         end,
         provider_checkout_status = case
           when $12::boolean then $13
           else provider_checkout_status
         end,
         provider_payment_status = case
           when $14::boolean then $15
           else provider_payment_status
         end,
         provider_risk_status = case
           when $16::boolean then $17
           else provider_risk_status
         end,
         provider_settlement_status = case
           when $18::boolean then $19
           else provider_settlement_status
         end,
         provider_refund_status = case
           when $20::boolean then $21
           else provider_refund_status
         end,
         provider_dispute_status = case
           when $22::boolean then $23
           else provider_dispute_status
         end,
         net_amount_in_cents = case
           when $24::boolean then $25
           else net_amount_in_cents
         end,
         fee_amount_in_cents = case
           when $26::boolean then $27
           else fee_amount_in_cents
         end,
         paid_at = case
           when $4::boolean and $5::order_status = 'paid'
             then coalesce(paid_at, now())
           else paid_at
         end,
         refunded_at = case
           when $4::boolean and $5::order_status = 'refunded'
             then coalesce(refunded_at, now())
           else refunded_at
         end,
         updated_at = now()
     where id = $1
       and provider = 'asaas'
       and (
         provider_checkout_id is null
         or $2::text is null
         or provider_checkout_id = $2::text
       )
       and (
         provider_payment_id is null
         or $3::text is null
         or provider_payment_id = $3::text
       )
     returning id`,
    [
      orderId,
      getIncomingCheckoutId(correlation),
      correlation.paymentId,
      orderStatus !== null,
      orderStatus,
      checkoutStatus !== null,
      checkoutStatus,
      updates.paidAmountInCents !== undefined,
      updates.paidAmountInCents ?? null,
      updates.paymentMethod !== undefined,
      updates.paymentMethod ?? null,
      updates.providerCheckoutStatus !== undefined,
      updates.providerCheckoutStatus ?? null,
      updates.providerPaymentStatus !== undefined,
      updates.providerPaymentStatus ?? null,
      updates.providerRiskStatus !== undefined,
      updates.providerRiskStatus ?? null,
      updates.providerSettlementStatus !== undefined,
      updates.providerSettlementStatus ?? null,
      updates.providerRefundStatus !== undefined,
      updates.providerRefundStatus ?? null,
      updates.providerDisputeStatus !== undefined,
      updates.providerDisputeStatus ?? null,
      updates.netAmountInCents !== undefined,
      updates.netAmountInCents ?? null,
      updates.feeAmountInCents !== undefined,
      updates.feeAmountInCents ?? null,
    ]
  );
  return getString(result.rows[0], "id") !== null;
};

const preserveProviderEvidence = (
  decision: AsaasFinancialEventDecision
): AsaasFinancialEventDecision => ({
  ...decision,
  effect: "none",
  updates: {
    ...(decision.updates.feeAmountInCents === undefined
      ? {}
      : { feeAmountInCents: decision.updates.feeAmountInCents }),
    ...(decision.updates.netAmountInCents === undefined
      ? {}
      : { netAmountInCents: decision.updates.netAmountInCents }),
    ...(decision.updates.paymentMethod === undefined
      ? {}
      : { paymentMethod: decision.updates.paymentMethod }),
    ...(decision.updates.providerCheckoutStatus === undefined
      ? {}
      : { providerCheckoutStatus: decision.updates.providerCheckoutStatus }),
    ...(decision.updates.providerDisputeStatus === undefined
      ? {}
      : { providerDisputeStatus: decision.updates.providerDisputeStatus }),
    ...(decision.updates.providerPaymentStatus === undefined
      ? {}
      : { providerPaymentStatus: decision.updates.providerPaymentStatus }),
    ...(decision.updates.providerRefundStatus === undefined
      ? {}
      : { providerRefundStatus: decision.updates.providerRefundStatus }),
    ...(decision.updates.providerRiskStatus === undefined
      ? {}
      : { providerRiskStatus: decision.updates.providerRiskStatus }),
    ...(decision.updates.providerSettlementStatus === undefined
      ? {}
      : {
          providerSettlementStatus: decision.updates.providerSettlementStatus,
        }),
  },
});

const blockGrantUnderPendingReview = async ({
  client,
  decision,
  orderId,
}: {
  client: PoolClient;
  decision: AsaasFinancialEventDecision;
  orderId: string;
}): Promise<AsaasFinancialEventDecision> => {
  if (decision.effect !== "grant") {
    return decision;
  }
  if (decision.reviewReason) {
    return preserveProviderEvidence(decision);
  }
  const pendingReview = await client.query(
    `select id
     from payment_reviews
     where order_id = $1 and status = 'pending'
     limit 1`,
    [orderId]
  );
  return getString(pendingReview.rows[0], "id")
    ? preserveProviderEvidence(decision)
    : decision;
};

const validateGrantOrder = (
  order: LockedOrderRow
): { accessDurationMonths: number; courseId: string } | null => {
  if (
    !(
      order.accessDurationMonths &&
      Number.isInteger(order.accessDurationMonths) &&
      order.accessDurationMonths > 0
    )
  ) {
    return null;
  }
  return {
    accessDurationMonths: order.accessDurationMonths,
    courseId: order.courseId,
  };
};

type DecisionEffectOutcome =
  | "applied"
  | "identity_review"
  | "local_anomaly"
  | "none";

const consumeResolvedPreparation = async ({
  client,
  order,
  preparation,
}: {
  client: PoolClient;
  order: LockedOrderRow;
  preparation: Extract<AsaasBuyerIdentityPreparation, { kind: "resolved" }>;
}): Promise<LockedOrderRow | null> => {
  const persisted = await client.query(
    `update orders
     set provider_customer_id = $2,
         customer_name = $3,
         customer_email = $4,
         updated_at = now()
     where id = $1
       and user_id is null
       and buyer_identity_status = 'pending'
       and provider_customer_id is null
       and customer_name is null
       and customer_email is null
     returning id`,
    [
      order.id,
      preparation.customerId,
      preparation.identity.name,
      preparation.identity.email,
    ]
  );
  if (getString(persisted.rows[0], "id")) {
    return {
      ...order,
      customerEmail: preparation.identity.email,
      customerName: preparation.identity.name,
      providerCustomerId: preparation.customerId,
    };
  }

  const current = await loadLockedOrder({ client, orderId: order.id });
  return current.buyerIdentityStatus === "pending" &&
    current.userId === null &&
    current.providerCustomerId === preparation.customerId &&
    current.customerName === preparation.identity.name &&
    current.customerEmail === preparation.identity.email
    ? current
    : null;
};

const prepareGrantIdentity = async ({
  client,
  eventId,
  order,
  preparation,
}: {
  client: PoolClient;
  eventId: string;
  order: LockedOrderRow;
  preparation: AsaasBuyerIdentityPreparation;
}): Promise<LockedOrderRow | null> => {
  if (order.buyerIdentityStatus === "review_required") {
    return null;
  }
  if (order.buyerIdentityStatus === "resolved") {
    if (preparation.kind === "not_required" && order.userId) {
      return order;
    }
    await openBuyerIdentityReview({
      client,
      eventId,
      orderId: order.id,
      reason: "buyer_identity_conflict",
    });
    return null;
  }

  if (preparation.kind === "not_required") {
    await openBuyerIdentityReview({
      client,
      eventId,
      orderId: order.id,
      reason: "buyer_identity_missing",
    });
    return null;
  }
  if (preparation.orderId !== order.id) {
    await openBuyerIdentityReview({
      client,
      eventId,
      orderId: order.id,
      reason: "buyer_identity_conflict",
    });
    return null;
  }
  if (preparation.kind === "review_required") {
    await openBuyerIdentityReview({
      client,
      eventId,
      orderId: order.id,
      reason: preparation.reason,
    });
    return null;
  }

  const preparedOrder = await consumeResolvedPreparation({
    client,
    order,
    preparation,
  });
  if (preparedOrder) {
    return preparedOrder;
  }
  await openBuyerIdentityReview({
    client,
    eventId,
    orderId: order.id,
    reason: "buyer_identity_conflict",
  });
  return null;
};

const getRevocationReason = ({
  decision,
  order,
}: {
  decision: AsaasFinancialEventDecision;
  order: LockedOrderRow;
}): "payment_dispute" | "payment_refund" => {
  if (order.orderStatus === "disputed") {
    return "payment_dispute";
  }
  if (order.orderStatus === "refunded") {
    return "payment_refund";
  }
  return decision.updates.orderStatus === "disputed" ||
    decision.updates.providerDisputeStatus !== undefined
    ? "payment_dispute"
    : "payment_refund";
};

const applyDecisionEffect = async ({
  client,
  decision,
  dependencies,
  eventId,
  order,
  preparation,
}: {
  client: PoolClient;
  decision: AsaasFinancialEventDecision;
  dependencies: ProcessorDependencies;
  eventId: string;
  order: LockedOrderRow;
  preparation: AsaasBuyerIdentityPreparation;
}): Promise<DecisionEffectOutcome> => {
  if (decision.effect === "grant") {
    const grantOrder = validateGrantOrder(order);
    if (!grantOrder) {
      return "local_anomaly";
    }
    const preparedOrder = await prepareGrantIdentity({
      client,
      eventId,
      order,
      preparation,
    });
    if (!preparedOrder) {
      return "identity_review";
    }
    let identity: Awaited<ReturnType<typeof resolveLocalOrderIdentity>>;
    try {
      identity = await dependencies.resolveIdentity({
        client,
        order: {
          buyerIdentityStatus: preparedOrder.buyerIdentityStatus,
          courseId: preparedOrder.courseId,
          customerEmail: preparedOrder.customerEmail,
          customerName: preparedOrder.customerName,
          orderId: preparedOrder.id,
          userId: preparedOrder.userId,
        },
      });
    } catch (error) {
      if (error instanceof LocalOrderIdentityError) {
        await openBuyerIdentityReview({
          client,
          eventId,
          orderId: order.id,
          reason: localIdentityReviewReasons[error.code],
        });
        return "identity_review";
      }
      throw error;
    }
    const now = dependencies.now();
    await dependencies.applyPaidAccess({
      accessDurationMonths: grantOrder.accessDurationMonths,
      client,
      courseId: grantOrder.courseId,
      now,
      orderId: order.id,
      userId: identity.userId,
    });
    const message = identity.activationRequired
      ? createAccountActivationMessage({
          orderId: order.id,
          userId: identity.userId,
        })
      : createPaidAccessReleasedMessage({
          courseId: grantOrder.courseId,
          orderId: order.id,
          userId: identity.userId,
        });
    await dependencies.enqueueMessage({ client, message });
    return "applied";
  }

  if (decision.effect === "revoke") {
    if (!order.userId) {
      return "none";
    }
    const now = dependencies.now();
    const reason = getRevocationReason({ decision, order });
    const applied = await dependencies.applyRevocation({
      client,
      courseId: order.courseId,
      now,
      orderId: order.id,
      reason,
      userId: order.userId,
    });
    return applied === false ? "none" : "applied";
  }

  return "none";
};

const reviewLocalEffectAnomaly = async ({
  client,
  eventId,
  orderId,
  outcome,
}: {
  client: PoolClient;
  eventId: string;
  orderId: string;
  outcome: DecisionEffectOutcome;
}): Promise<void> => {
  if (outcome !== "local_anomaly") {
    return;
  }
  await insertReview({
    client,
    eventId,
    orderId,
    reason: "event_anomaly",
  });
};

const confirmRefundRequest = async ({
  client,
  evidence,
  now,
  orderId,
}: {
  client: PoolClient;
  evidence: RefundEvidence | null;
  now: Date;
  orderId: string;
}): Promise<boolean> => {
  const confirmed = await client.query(
    `update refund_requests
     set status = 'confirmed',
         confirmed_at = coalesce(confirmed_at, $2),
         provider_refund_status = coalesce($3, provider_refund_status),
         provider_refund_created_at = coalesce($4, provider_refund_created_at),
         provider_refund_end_to_end_id = coalesce($5, provider_refund_end_to_end_id),
         provider_refund_receipt_url = coalesce($6, provider_refund_receipt_url),
         provider_refunded_amount_in_cents = coalesce($7, provider_refunded_amount_in_cents),
         error_message = null,
         updated_at = now()
     where order_id = $1
       and status in ('processing', 'uncertain', 'confirmed')
     returning id`,
    [
      orderId,
      now,
      evidence?.status ?? null,
      evidence?.dateCreated ?? null,
      evidence?.endToEndIdentifier ?? null,
      evidence?.receiptUrl ?? null,
      evidence?.valueInCents ?? null,
    ]
  );
  return getString(confirmed.rows[0], "id") !== null;
};

const closeRefundedBuyerIdentityReview = async ({
  client,
  now,
  orderId,
}: {
  client: PoolClient;
  now: Date;
  orderId: string;
}): Promise<void> => {
  await client.query(
    `update payment_reviews
set status='rejected',
 decision_reason='buyer_identity_refunded',
 resolved_by_user_id=null,
 resolved_at=coalesce(resolved_at,$2),
 updated_at=now()
where order_id=$1 and type='buyer_identity' and status='pending'`,
    [orderId, now]
  );
};

const shouldConfirmRefundRequest = ({
  decision,
  eventName,
  order,
  payload,
}: {
  decision: AsaasFinancialEventDecision;
  eventName: string;
  order: LockedOrderRow;
  payload: unknown;
}): boolean => {
  const reviewAllowsConfirmation =
    decision.reviewReason === null ||
    decision.reviewReason === "terminal_conflict";
  return (
    eventName === "PAYMENT_REFUNDED" &&
    reviewAllowsConfirmation &&
    hasExactPaymentAmount({
      expectedAmountInCents: order.amountInCents,
      payload,
    })
  );
};

const confirmRefundAndCloseBuyerIdentityReview = async ({
  client,
  decision,
  eventName,
  getNow,
  order,
  payload,
}: {
  client: PoolClient;
  decision: AsaasFinancialEventDecision;
  eventName: string;
  getNow: ProcessorDependencies["now"];
  order: LockedOrderRow;
  payload: unknown;
}): Promise<void> => {
  const evidence = getExactRefundEvidence({
    expectedAmountInCents: order.amountInCents,
    payload,
  });
  if (
    !(
      evidence &&
      shouldConfirmRefundRequest({ decision, eventName, order, payload })
    )
  ) {
    return;
  }
  const now = getNow();
  const refundRequestConfirmed = await confirmRefundRequest({
    client,
    evidence,
    now,
    orderId: order.id,
  });
  if (!refundRequestConfirmed) {
    return;
  }
  await closeRefundedBuyerIdentityReview({
    client,
    now,
    orderId: order.id,
  });
};

export const createAsaasWebhookProcessor = (
  overrides: Partial<ProcessorDependencies> = {}
): AsaasWebhookProcessor => {
  const dependencies = { ...defaultDependencies, ...overrides };
  const process: AsaasWebhookProcessor["process"] = async (
    event,
    context,
    preparation
  ) => {
    const preliminaryDecision = decideAsaasFinancialEvent({
      payload: event.payload,
      snapshot: emptySnapshot,
    });
    if (preliminaryDecision.action === "ignore") {
      await insertSafeAlert({
        client: context.client,
        eventId: event.id,
        reason: "unknown_event",
      });
      return { outcome: "ignored" };
    }

    const correlationRows = await findCorrelationRows({
      client: context.client,
      correlation: preliminaryDecision.correlation,
      existingOrderId: event.orderId,
    });
    const candidateIds = [...new Set(correlationRows.map(({ id }) => id))];
    if (candidateIds.length === 0) {
      await insertSafeAlert({
        client: context.client,
        eventId: event.id,
        reason: "no_correlation",
      });
      return { outcome: "ignored" };
    }
    if (candidateIds.length > 1) {
      await insertSafeAlert({
        client: context.client,
        eventId: event.id,
        reason: "ambiguous_identifiers",
      });
      return { outcome: "ignored" };
    }

    const orderId = candidateIds[0];
    if (!orderId) {
      throw new AsaasWebhookProcessingError("correlation_failed", {
        retryable: false,
      });
    }
    await context.lockOrder(orderId);
    const order = await loadLockedOrder({
      client: context.client,
      orderId,
    });
    await associateWebhookEvent({
      client: context.client,
      eventId: event.id,
      orderId,
    });

    if (
      hasIdentifierConflict({
        correlation: preliminaryDecision.correlation,
        order,
      })
    ) {
      await insertReview({
        client: context.client,
        eventId: event.id,
        orderId,
        reason: "event_anomaly",
      });
      await insertSafeAlert({
        client: context.client,
        eventId: event.id,
        reason: "identifier_conflict",
      });
      return { outcome: "processed" };
    }

    const matrixDecision = decideAsaasFinancialEvent({
      payload: event.payload,
      snapshot: {
        amountInCents: order.amountInCents,
        checkoutStatus: order.checkoutStatus,
        orderStatus: order.orderStatus,
        providerPaymentStatus: order.providerPaymentStatus,
        providerRiskStatus: order.providerRiskStatus,
      },
    });
    const decision = await blockGrantUnderPendingReview({
      client: context.client,
      decision: matrixDecision,
      orderId,
    });
    const persisted = await persistDecision({
      client: context.client,
      correlation: decision.correlation,
      decision,
      orderId,
    });
    if (!persisted) {
      await insertReview({
        client: context.client,
        eventId: event.id,
        orderId,
        reason: "event_anomaly",
      });
      await insertSafeAlert({
        client: context.client,
        eventId: event.id,
        reason: "identifier_conflict",
      });
      return { outcome: "processed" };
    }
    if (decision.reviewReason) {
      await insertReview({
        client: context.client,
        eventId: event.id,
        orderId,
        reason: decision.reviewReason,
      });
    }
    await confirmRefundAndCloseBuyerIdentityReview({
      client: context.client,
      decision,
      eventName: event.eventName,
      getNow: dependencies.now,
      order,
      payload: event.payload,
    });
    if (decision.reviewReason && decision.effect !== "revoke") {
      return { outcome: "processed" };
    }
    const effectOutcome = await applyDecisionEffect({
      client: context.client,
      decision,
      dependencies,
      eventId: event.id,
      order,
      preparation,
    });
    await reviewLocalEffectAnomaly({
      client: context.client,
      eventId: event.id,
      orderId,
      outcome: effectOutcome,
    });
    return { outcome: "processed" };
  };
  return {
    prepare: async (event) =>
      await dependencies.prepareIdentity(event, dependencies.gateway),
    process,
  };
};

export const processAsaasWebhookEvent = createAsaasWebhookProcessor();
