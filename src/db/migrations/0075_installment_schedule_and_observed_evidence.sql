ALTER TYPE "public"."financial_event_source" ADD VALUE 'installment' BEFORE 'migration';--> statement-breakpoint
CREATE TABLE "asaas_installment_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"provider_installment_id" text NOT NULL,
	"provider_payment_id" text NOT NULL,
	"installment_number" integer,
	"status" text NOT NULL,
	"due_date" text,
	"payment_date" text,
	"client_payment_date" text,
	"value_in_cents" integer NOT NULL,
	"net_value_in_cents" integer,
	"fee_amount_in_cents" integer,
	"anticipated" boolean,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asaas_installment_payments_installment_number_positive" CHECK ("asaas_installment_payments"."installment_number" is null or "asaas_installment_payments"."installment_number" >= 1),
	CONSTRAINT "asaas_installment_payments_amounts_consistent" CHECK ("asaas_installment_payments"."value_in_cents" > 0
        and ("asaas_installment_payments"."net_value_in_cents" is null or ("asaas_installment_payments"."net_value_in_cents" >= 0 and "asaas_installment_payments"."net_value_in_cents" <= "asaas_installment_payments"."value_in_cents"))
        and ("asaas_installment_payments"."fee_amount_in_cents" is null or "asaas_installment_payments"."fee_amount_in_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "observed_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "observed_net_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "observed_fee_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "asaas_installment_payments" ADD CONSTRAINT "asaas_installment_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asaas_installment_payments_provider_payment_unique_idx" ON "asaas_installment_payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "asaas_installment_payments_order_number_idx" ON "asaas_installment_payments" USING btree ("order_id","installment_number");--> statement-breakpoint
CREATE INDEX "asaas_installment_payments_installment_status_idx" ON "asaas_installment_payments" USING btree ("provider_installment_id","status");--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_observed_amounts_non_negative" CHECK (("payment_reviews"."observed_amount_in_cents" is null or "payment_reviews"."observed_amount_in_cents" >= 0)
        and ("payment_reviews"."observed_net_amount_in_cents" is null or "payment_reviews"."observed_net_amount_in_cents" >= 0)
        and ("payment_reviews"."observed_fee_amount_in_cents" is null or "payment_reviews"."observed_fee_amount_in_cents" >= 0));