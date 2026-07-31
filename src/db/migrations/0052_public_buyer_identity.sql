CREATE TYPE "public"."buyer_identity_status" AS ENUM('pending', 'resolved', 'review_required');--> statement-breakpoint
ALTER TYPE "public"."payment_review_type" ADD VALUE 'buyer_identity';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "buyer_identity_status" "buyer_identity_status";
UPDATE "orders"
SET "buyer_identity_status" = CASE
  WHEN "user_id" IS NOT NULL THEN 'resolved'::"buyer_identity_status"
  ELSE 'pending'::"buyer_identity_status"
END;
ALTER TABLE "orders" ALTER COLUMN "buyer_identity_status" SET NOT NULL;
