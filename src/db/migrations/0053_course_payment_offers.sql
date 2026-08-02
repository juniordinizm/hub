ALTER TABLE "courses" ADD COLUMN "payment_allow_pix" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "payment_allow_credit_card" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "payment_max_installment_count" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_installment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_allow_pix" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_allow_credit_card" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_max_installment_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_installment_unique_idx" ON "orders" USING btree ("provider","provider_installment_id") WHERE "orders"."provider_installment_id" is not null;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_payment_method_required" CHECK ("courses"."payment_allow_pix" or "courses"."payment_allow_credit_card");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_payment_installment_count_valid" CHECK ("courses"."payment_max_installment_count" between 1 and 21);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_payment_installment_requires_card" CHECK ("courses"."payment_allow_credit_card" or "courses"."payment_max_installment_count" = 1);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_required" CHECK ("orders"."payment_allow_pix" or "orders"."payment_allow_credit_card");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_installment_count_valid" CHECK ("orders"."payment_max_installment_count" between 1 and 21);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_installment_requires_card" CHECK ("orders"."payment_allow_credit_card" or "orders"."payment_max_installment_count" = 1);