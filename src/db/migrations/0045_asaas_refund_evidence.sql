ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_status" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_created_at" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_end_to_end_id" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_receipt_url" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "provider_refunded_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "refund_requests" DROP COLUMN "provider_refund_id";--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_provider_amount_positive" CHECK ("refund_requests"."provider_refunded_amount_in_cents" is null or "refund_requests"."provider_refunded_amount_in_cents" > 0);
