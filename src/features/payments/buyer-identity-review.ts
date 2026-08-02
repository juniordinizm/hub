import type { PoolClient } from "pg";

export const closeRefundedBuyerIdentityReview = async ({
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
