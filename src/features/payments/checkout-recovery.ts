import "server-only";
import { getPool } from "@/db";
import type {
  CheckoutApiResponse,
  PublicCheckoutStatusQuery,
} from "./checkout-api";

export const CHECKOUT_RESERVATION_RECOVERY_SECONDS = 30;

interface RecoverableCheckoutRow {
  checkout_attempt_count?: number;
  checkout_last_attempt_at?: Date | null;
  checkout_next_attempt_at?: Date | null;
  checkout_status:
    | "active"
    | "cancelled"
    | "creating"
    | "expired"
    | "failed"
    | "pending"
    | "uncertain";
  checkout_url: string | null;
  id: string;
  provider_checkout_id?: string | null;
  provider_customer_id?: string | null;
  provider_payment_id?: string | null;
  updated_at?: Date | null;
}

export const isStalePreProviderReservation = ({
  now,
  order,
}: {
  now: Date;
  order: RecoverableCheckoutRow;
}): boolean => {
  if (
    order.checkout_status !== "pending" ||
    order.checkout_attempt_count !== 0 ||
    order.checkout_last_attempt_at ||
    order.checkout_next_attempt_at ||
    order.provider_checkout_id ||
    order.provider_customer_id ||
    order.provider_payment_id ||
    !order.updated_at
  ) {
    return false;
  }

  return (
    now.getTime() - order.updated_at.getTime() >=
    CHECKOUT_RESERVATION_RECOVERY_SECONDS * 1000
  );
};

export const expireStalePreProviderReservation = async ({
  attemptId,
  now,
}: {
  attemptId: string;
  now: Date;
}): Promise<boolean> => {
  const result = await getPool().query<{ id: string }>(
    `
      update orders
      set checkout_status = 'failed',
          checkout_error_message = 'checkout_reservation_expired',
          checkout_next_attempt_at = $2,
          updated_at = now()
      where id = $1
        and provider = 'asaas'
        and status = 'pending'
        and checkout_status = 'pending'
        and checkout_attempt_count = 0
        and checkout_last_attempt_at is null
        and checkout_next_attempt_at is null
        and provider_checkout_id is null
        and provider_customer_id is null
        and provider_payment_id is null
        and checkout_url is null
        and updated_at <= $2 - ($3 * interval '1 second')
      returning id
    `,
    [attemptId, now, CHECKOUT_RESERVATION_RECOVERY_SECONDS]
  );
  return Boolean(result.rows[0]);
};

export const readPublicCheckoutStatus = async (
  input: PublicCheckoutStatusQuery
): Promise<CheckoutApiResponse> => {
  const result = await getPool().query<RecoverableCheckoutRow>(
    `
      select id, checkout_status, checkout_url,
             checkout_attempt_count, checkout_last_attempt_at,
             checkout_next_attempt_at,
             provider_checkout_id, provider_customer_id, provider_payment_id,
             updated_at
      from orders
      where id = $1
        and checkout_course_slug = $2
        and provider = 'asaas'
      limit 1
    `,
    [input.checkoutAttemptId, input.courseSlug]
  );
  const order = result.rows[0];
  if (!order) {
    return {
      error: "Checkout indisponivel.",
      retryAllowed: false,
      status: "unavailable",
    };
  }

  const now = (input.now ?? (() => new Date()))();
  if (isStalePreProviderReservation({ now, order })) {
    const expired = await expireStalePreProviderReservation({
      attemptId: order.id,
      now,
    });
    if (expired) {
      return { orderId: order.id, retryAllowed: true, status: "failed" };
    }
  }

  if (order.checkout_status === "active" && order.checkout_url) {
    return {
      orderId: order.id,
      redirectUrl: order.checkout_url,
      retryAllowed: false,
      status: "ready",
    };
  }

  if (
    order.checkout_status === "active" ||
    order.checkout_status === "creating" ||
    order.checkout_status === "pending" ||
    order.checkout_status === "uncertain"
  ) {
    return {
      orderId: order.id,
      retryAllowed: false,
      status: "processing",
    };
  }

  return {
    orderId: order.id,
    retryAllowed: true,
    status: "failed",
  };
};
