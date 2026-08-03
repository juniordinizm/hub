import "server-only";
import type { PoolClient } from "pg";
import { applyPaidWebhookAccess } from "@/features/enrollments/server";
import {
  createAccountActivationMessage,
  createPaidAccessReleasedMessage,
} from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import type { AsaasBuyerIdentityPreparation } from "@/features/payments/asaas-customer-enrichment";
import {
  LocalOrderIdentityError,
  resolveLocalOrderIdentity,
} from "@/features/payments/order-identity";

export type BuyerIdentityReviewReason =
  | "buyer_identity_conflict"
  | "buyer_identity_course_revoked"
  | "buyer_identity_invalid"
  | "buyer_identity_missing"
  | "buyer_identity_platform_blocked"
  | "buyer_identity_team_account";

export type PersistedOrderStatus =
  | "cancelled"
  | "disputed"
  | "paid"
  | "pending"
  | "refunded";

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

export interface ConfirmedPaymentAccessOrder {
  accessDurationMonths: number | null;
  buyerIdentityStatus: "pending" | "resolved" | "review_required";
  courseId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  id: string;
  providerCustomerId?: string | null;
  status: PersistedOrderStatus;
  userId: string | null;
}

interface PreparedOrderIdentity {
  customerEmail: string | null;
  customerName: string | null;
}

const isEligibleGrantOrder = (
  order: ConfirmedPaymentAccessOrder
): order is ConfirmedPaymentAccessOrder & { accessDurationMonths: number } =>
  (order.status === "pending" || order.status === "paid") &&
  Boolean(order.accessDurationMonths) &&
  Number.isInteger(order.accessDurationMonths) &&
  (order.accessDurationMonths ?? 0) > 0;

const prepareOrderIdentity = async ({
  client,
  onIdentityReview,
  order,
  preparation,
}: {
  client: PoolClient;
  onIdentityReview?: (reason: BuyerIdentityReviewReason) => Promise<void>;
  order: ConfirmedPaymentAccessOrder;
  preparation: AsaasBuyerIdentityPreparation;
}): Promise<PreparedOrderIdentity | null> => {
  if (order.buyerIdentityStatus === "resolved" && order.userId) {
    if (preparation.kind === "not_required") {
      return {
        customerEmail: order.customerEmail ?? null,
        customerName: order.customerName ?? null,
      };
    }
    await onIdentityReview?.("buyer_identity_conflict");
    return null;
  }
  if (!(order.buyerIdentityStatus === "pending" && !order.userId)) {
    await onIdentityReview?.("buyer_identity_conflict");
    return null;
  }
  if (preparation.kind === "not_required") {
    await onIdentityReview?.("buyer_identity_missing");
    return null;
  }
  if (preparation.orderId !== order.id) {
    await onIdentityReview?.("buyer_identity_conflict");
    return null;
  }
  if (preparation.kind === "review_required") {
    await onIdentityReview?.(preparation.reason);
    return null;
  }

  const persisted = await client.query<{ id: string }>(
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
  const matchesPersistedPreparation =
    order.providerCustomerId === preparation.customerId &&
    order.customerName === preparation.identity.name &&
    order.customerEmail === preparation.identity.email;
  if (!(persisted.rows[0] || matchesPersistedPreparation)) {
    await onIdentityReview?.("buyer_identity_conflict");
    return null;
  }
  return {
    customerEmail: preparation.identity.email,
    customerName: preparation.identity.name,
  };
};

export const persistConfirmedPaymentStatus = async ({
  client,
  now,
  orderId,
}: {
  client: PoolClient;
  now: Date;
  orderId: string;
}): Promise<boolean> => {
  const paid = await client.query<{ id: string }>(
    `with transitioned as (
       update orders
       set status = 'paid',
           paid_at = coalesce(paid_at, $2),
           updated_at = now()
       where id = $1
         and status = 'pending'
         and not exists (
           select 1
           from payment_reviews
           where order_id = $1 and status = 'pending'
         )
       returning id
     )
     select id from transitioned
     union all
     select id
     from orders
     where id = $1
       and status = 'paid'
       and not exists (
         select 1
         from payment_reviews
         where order_id = $1 and status = 'pending'
       )
     limit 1`,
    [orderId, now]
  );
  return Boolean(paid.rows[0]);
};

export const applyConfirmedPaymentAccess = async ({
  applyPaidAccess = applyPaidWebhookAccess,
  client,
  enqueueMessage = enqueueOutboxMessage,
  now = new Date(),
  onIdentityReview,
  order,
  preparation = { kind: "not_required" },
  resolveIdentity = resolveLocalOrderIdentity,
}: {
  applyPaidAccess?: typeof applyPaidWebhookAccess;
  client: PoolClient;
  enqueueMessage?: typeof enqueueOutboxMessage;
  now?: Date;
  onIdentityReview?: (reason: BuyerIdentityReviewReason) => Promise<void>;
  order: ConfirmedPaymentAccessOrder;
  preparation?: AsaasBuyerIdentityPreparation;
  resolveIdentity?: typeof resolveLocalOrderIdentity;
}): Promise<boolean> => {
  if (!isEligibleGrantOrder(order)) {
    return false;
  }

  const financiallyPaid = await persistConfirmedPaymentStatus({
    client,
    now,
    orderId: order.id,
  });
  if (!financiallyPaid) {
    return false;
  }

  const preparedIdentity = await prepareOrderIdentity({
    client,
    order,
    preparation,
    ...(onIdentityReview ? { onIdentityReview } : {}),
  });
  if (!preparedIdentity) {
    return false;
  }

  let identity: Awaited<ReturnType<typeof resolveLocalOrderIdentity>>;
  try {
    identity = await resolveIdentity({
      client,
      order: {
        buyerIdentityStatus: order.buyerIdentityStatus,
        courseId: order.courseId,
        customerEmail: preparedIdentity.customerEmail,
        customerName: preparedIdentity.customerName,
        orderId: order.id,
        userId: order.userId,
      },
    });
  } catch (error) {
    if (error instanceof LocalOrderIdentityError && onIdentityReview) {
      await onIdentityReview(localIdentityReviewReasons[error.code]);
      return false;
    }
    throw error;
  }

  await applyPaidAccess({
    accessDurationMonths: order.accessDurationMonths,
    client,
    courseId: order.courseId,
    now,
    orderId: order.id,
    userId: identity.userId,
  });
  await enqueueMessage({
    client,
    message: identity.activationRequired
      ? createAccountActivationMessage({
          orderId: order.id,
          userId: identity.userId,
        })
      : createPaidAccessReleasedMessage({
          courseId: order.courseId,
          orderId: order.id,
          userId: identity.userId,
        }),
  });
  return true;
};
