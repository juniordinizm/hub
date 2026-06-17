ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'disputed';--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "expiry_warning_7d_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "expiry_warning_1d_sent_at" timestamp with time zone;
