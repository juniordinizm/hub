import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { applyPaidWebhookAccess } from "@/features/enrollments/server";

interface PaymentReviewRow {
  access_duration_months: number | null;
  course_id: string;
  observed_amount_in_cents: number | null;
  observed_fee_amount_in_cents: number | null;
  observed_net_amount_in_cents: number | null;
  order_id: string;
  status: "pending" | "paid" | "cancelled" | "refunded" | "disputed";
  type:
    | "amount_mismatch"
    | "buyer_identity"
    | "event_anomaly"
    | "partial_refund"
    | "terminal_conflict"
    | "uncertain_result";
  user_id: string | null;
}

const selectPendingReview = async ({
  client,
  reviewId,
}: {
  client: PoolClient;
  reviewId: string;
}): Promise<PaymentReviewRow | null> => {
  const review = await client.query<PaymentReviewRow>(
    `
      select
        payment_reviews.order_id,
        payment_reviews.observed_amount_in_cents,
        payment_reviews.observed_net_amount_in_cents,
        payment_reviews.observed_fee_amount_in_cents,
        payment_reviews.type,
        orders.status,
        orders.course_id,
        orders.user_id,
        orders.access_duration_months
      from payment_reviews
      join orders on orders.id = payment_reviews.order_id
      where payment_reviews.id = $1
        and payment_reviews.status = 'pending'
      for update of payment_reviews, orders
    `,
    [reviewId]
  );

  return review.rows[0] ?? null;
};

const approveAmountMismatch = async ({
  client,
  review,
}: {
  client: PoolClient;
  review: PaymentReviewRow;
}): Promise<void> => {
  if (!(review.user_id && review.access_duration_months)) {
    throw new Error("Pedido sem dados suficientes para liberar o acesso.");
  }
  if (review.observed_amount_in_cents == null) {
    throw new Error(
      "Divergencia sem valor observado; concilie o pagamento antes de liberar o acesso."
    );
  }

  const paid = await client.query<{ id: string }>(
    `
      update orders
      set status = 'paid',
          paid_amount_in_cents = coalesce(paid_amount_in_cents, $2),
          net_amount_in_cents = coalesce(net_amount_in_cents, $3),
          fee_amount_in_cents = coalesce(fee_amount_in_cents, $4),
          paid_at = coalesce(paid_at, now()),
          updated_at = now()
      where id = $1 and status = 'pending'
      returning id
    `,
    [
      review.order_id,
      review.observed_amount_in_cents,
      review.observed_net_amount_in_cents,
      review.observed_fee_amount_in_cents,
    ]
  );

  if (!paid.rows[0]) {
    throw new Error("O pedido nao esta mais pendente para liberacao manual.");
  }

  await applyPaidWebhookAccess({
    accessDurationMonths: review.access_duration_months,
    client,
    courseId: review.course_id,
    now: new Date(),
    orderId: review.order_id,
    userId: review.user_id,
  });
};

export const resolvePaymentReview = async ({
  actorUserId,
  decision,
  decisionReason,
  reviewId,
}: {
  actorUserId: string;
  decision: "approved" | "rejected";
  decisionReason: string;
  reviewId: string;
}): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const review = await selectPendingReview({ client, reviewId });

    if (!review) {
      throw new Error("Revisao financeira invalida ou ja resolvida.");
    }

    if (review.type === "buyer_identity") {
      throw new Error("Revisao de identidade exige reembolso integral.");
    }

    if (review.type === "event_anomaly") {
      throw new Error(
        "Anomalia financeira exige conciliacao ou reprocessamento."
      );
    }

    if (review.type === "partial_refund") {
      throw new Error(
        "Reembolso parcial exige tratamento financeiro especifico."
      );
    }

    if (review.type === "terminal_conflict") {
      throw new Error("Conflito terminal exige conciliacao do pagamento.");
    }

    if (review.type === "uncertain_result") {
      throw new Error("Resultado incerto exige conciliacao do pagamento.");
    }

    const trimmedDecisionReason = decisionReason.trim();
    if (!trimmedDecisionReason) {
      throw new Error("Informe o motivo da decisao financeira.");
    }

    if (review.type === "amount_mismatch" && decision === "approved") {
      await approveAmountMismatch({ client, review });
    }

    await client.query(
      `
        update payment_reviews
        set status = $2,
            decision_reason = $3,
            resolved_by_user_id = $4,
            resolved_at = now(),
            updated_at = now()
        where id = $1
      `,
      [reviewId, decision, trimmedDecisionReason, actorUserId]
    );
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, $2, 'payment_review', $3, jsonb_build_object('decision', $4, 'reason', $5))
      `,
      [
        actorUserId,
        "payment_review.resolved",
        reviewId,
        decision,
        trimmedDecisionReason,
      ]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
