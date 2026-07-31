CREATE TYPE "public"."checkout_status" AS ENUM('pending', 'creating', 'active', 'failed', 'uncertain', 'cancelled', 'expired');--> statement-breakpoint
ALTER TYPE "public"."payment_review_type" ADD VALUE 'event_anomaly';--> statement-breakpoint
ALTER TYPE "public"."payment_review_type" ADD VALUE 'partial_refund';--> statement-breakpoint
ALTER TYPE "public"."payment_review_type" ADD VALUE 'uncertain_result';--> statement-breakpoint
ALTER TYPE "public"."refund_request_status" ADD VALUE 'processing' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."refund_request_status" ADD VALUE 'uncertain' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."webhook_status" ADD VALUE 'processing' BEFORE 'processed';--> statement-breakpoint
ALTER TYPE "public"."webhook_status" ADD VALUE 'retryable' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "provider_order_id" TO "provider_checkout_id";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "provider_checkout_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_price_in_cents_non_negative";--> statement-breakpoint
ALTER TABLE "enrollment_grants" DROP CONSTRAINT "enrollment_grants_source_shape_check";--> statement-breakpoint
ALTER TYPE "public"."enrollment_grant_source_type" RENAME VALUE 'abacatepay_order' TO 'paid_order';--> statement-breakpoint
DROP INDEX "orders_provider_order_unique_idx";--> statement-breakpoint
DROP INDEX "webhook_events_status_idx";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "provider" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "provider" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_customer_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_status" "checkout_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_error_message" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_checkout_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_payment_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_risk_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_settlement_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_refund_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_dispute_status" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "payload_expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "payload_sanitized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_checkout_unique_idx" ON "orders" USING btree ("provider","provider_checkout_id") WHERE "orders"."provider_checkout_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_payment_unique_idx" ON "orders" USING btree ("provider","provider_payment_id") WHERE "orders"."provider_payment_id" is not null;--> statement-breakpoint
CREATE INDEX "orders_checkout_retry_idx" ON "orders" USING btree ("checkout_status","checkout_next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_events_status_retry_idx" ON "webhook_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_events_order_idx" ON "webhook_events" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "payment_provider_product_id";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_in_cents_zero_or_minimum" CHECK ("courses"."price_in_cents" = 0 or "courses"."price_in_cents" >= 1000);--> statement-breakpoint
ALTER TABLE "enrollment_grants" ADD CONSTRAINT "enrollment_grants_source_shape_check" CHECK (("enrollment_grants"."source_type" = 'paid_order' and "enrollment_grants"."order_id" is not null and "enrollment_grants"."manual_reference" is null) or ("enrollment_grants"."source_type" = 'manual' and "enrollment_grants"."order_id" is null and "enrollment_grants"."manual_reference" is not null));
