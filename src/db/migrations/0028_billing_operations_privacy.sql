CREATE TYPE "public"."payment_review_type" AS ENUM('amount_mismatch', 'terminal_conflict');--> statement-breakpoint
CREATE TYPE "public"."payment_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."refund_request_status" AS ENUM('requested', 'failed', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('valid', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."privacy_request_status" AS ENUM('requested', 'approved', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "payment_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "webhook_event_id" uuid,
  "type" "payment_review_type" NOT NULL,
  "status" "payment_review_status" DEFAULT 'pending' NOT NULL,
  "reason" text NOT NULL,
  "decision_reason" text,
  "resolved_by_user_id" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "requested_by_user_id" text NOT NULL,
  "reason" text NOT NULL,
  "status" "refund_request_status" DEFAULT 'requested' NOT NULL,
  "provider_refund_id" text,
  "error_message" text,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "privacy_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "requested_by_user_id" text,
  "status" "privacy_request_status" DEFAULT 'requested' NOT NULL,
  "reason" text NOT NULL,
  "resolved_by_user_id" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "public_certificate_rate_limits" (
  "key_hash" text PRIMARY KEY NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "status" "certificate_status" DEFAULT 'valid' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "revoked_reason" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "revoked_by_user_id" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "replaces_certificate_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_replaces_certificate_id_certificates_id_fk" FOREIGN KEY ("replaces_certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null;--> statement-breakpoint
DROP INDEX IF EXISTS "certificates_user_course_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_active_unique_idx" ON "certificates" USING btree ("user_id", "course_id") WHERE "certificates"."status" = 'valid';--> statement-breakpoint
CREATE INDEX "certificates_status_idx" ON "certificates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_reviews_order_status_idx" ON "payment_reviews" USING btree ("order_id", "status");--> statement-breakpoint
CREATE INDEX "payment_reviews_status_idx" ON "payment_reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_requests_order_unique_idx" ON "refund_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_requests_status_idx" ON "refund_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "privacy_requests_user_status_idx" ON "privacy_requests" USING btree ("user_id", "status");
--> statement-breakpoint
CREATE INDEX "public_certificate_rate_limits_expires_at_idx" ON "public_certificate_rate_limits" USING btree ("expires_at");
