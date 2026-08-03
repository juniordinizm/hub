import "server-only";
import { getPool } from "@/db";
import type {
  CheckoutApiResponse,
  PublicCheckoutStatusQuery,
} from "./checkout-api";

interface RecoverableCheckoutRow {
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
}

export const readPublicCheckoutStatus = async (
  input: PublicCheckoutStatusQuery
): Promise<CheckoutApiResponse> => {
  const result = await getPool().query<RecoverableCheckoutRow>(
    `
      select id, checkout_status, checkout_url
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
