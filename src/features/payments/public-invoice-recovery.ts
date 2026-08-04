import "server-only";
import { getPool } from "@/db";
import type { InvoiceIntentResult } from "./invoice-intent";
import { recoverAsaasInvoice } from "./invoice-recovery";
import { getAsaasProviderClient } from "./provider";

interface RecoveryOrderRow {
  amount_in_cents: number;
  checkout_status: string;
  checkout_url: string | null;
  external_id: string;
  id: string;
  installment_count: number;
  payment_method: "CREDIT_CARD" | "PIX" | null;
  provider_customer_id: string | null;
}

export const readPublicInvoiceStatus = async ({
  courseSlug,
  purchaseAttemptId,
}: {
  courseSlug: string;
  purchaseAttemptId: string;
}): Promise<InvoiceIntentResult | { status: "unavailable" }> => {
  const pool = getPool();
  const result = await pool.query<RecoveryOrderRow>(
    `select id, checkout_status, checkout_url, amount_in_cents,
            installment_count, payment_method, external_id, provider_customer_id
     from orders
     where id = $1 and checkout_course_slug = $2
       and provider = 'asaas' and provider_purchase_flow = 'invoice'
     limit 1`,
    [purchaseAttemptId, courseSlug]
  );
  const order = result.rows[0];
  if (!order) {
    return { status: "unavailable" };
  }
  if (order.checkout_status === "active" && order.checkout_url) {
    return {
      orderId: order.id,
      redirectUrl: order.checkout_url,
      status: "ready",
    };
  }
  if (order.checkout_status === "failed") {
    return { orderId: order.id, status: "failed" };
  }
  if (
    order.checkout_status !== "uncertain" ||
    !order.provider_customer_id ||
    !order.payment_method
  ) {
    return { orderId: order.id, status: "processing" };
  }

  return await recoverAsaasInvoice({
    gateway: getAsaasProviderClient(),
    intent: {
      amountInCents: order.amount_in_cents,
      billingType: order.payment_method,
      externalReference: order.external_id,
      installmentCount: order.installment_count,
      orderId: order.id,
      providerCustomerId: order.provider_customer_id,
    },
    markRecovered: async (recovered) => {
      await pool.query(
        `update orders
         set provider_payment_id = $2, provider_installment_id = $3,
             checkout_url = $4, provider_payment_status = $5,
             checkout_status = 'active', checkout_error_message = null,
             updated_at = now()
         where id = $1 and checkout_status = 'uncertain'`,
        [
          recovered.orderId,
          recovered.paymentId,
          recovered.installmentId,
          recovered.invoiceUrl,
          recovered.providerStatus,
        ]
      );
    },
    markReview: async (orderId) => {
      await pool.query(
        `insert into payment_reviews (order_id, type, status, reason)
         select $1, 'uncertain_result', 'pending', 'invoice_recovery_ambiguous'
         where not exists (
           select 1 from payment_reviews
           where order_id = $1 and type = 'uncertain_result' and status = 'pending'
         )`,
        [orderId]
      );
    },
  });
};
