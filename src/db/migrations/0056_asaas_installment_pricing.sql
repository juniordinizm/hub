CREATE TYPE "public"."asaas_customer_mapping_status" AS ENUM('pending', 'creating', 'ready', 'uncertain', 'failed');--> statement-breakpoint
CREATE TYPE "public"."course_card_pricing_policy" AS ENUM('seller_absorbs_all', 'buyer_pays_incremental_installment_cost');--> statement-breakpoint
CREATE TYPE "public"."provider_purchase_flow" AS ENUM('checkout', 'invoice');--> statement-breakpoint
CREATE TABLE "asaas_customer_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"identity_fingerprint" text NOT NULL,
	"normalized_email" text NOT NULL,
	"external_reference" text NOT NULL,
	"provider_customer_id" text,
	"status" "asaas_customer_mapping_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asaas_customer_mappings_attempt_count_non_negative" CHECK ("asaas_customer_mappings"."attempt_count" >= 0),
	CONSTRAINT "asaas_customer_mappings_ready_consistent" CHECK ("asaas_customer_mappings"."status" <> 'ready' or "asaas_customer_mappings"."provider_customer_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "course_payment_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"provider" text DEFAULT 'asaas' NOT NULL,
	"provider_environment" text NOT NULL,
	"signature" text NOT NULL,
	"base_amount_in_cents" integer NOT NULL,
	"allow_pix" boolean NOT NULL,
	"allow_credit_card" boolean NOT NULL,
	"max_installment_count" integer NOT NULL,
	"card_pricing_policy" "course_card_pricing_policy" NOT NULL,
	"options_json" jsonb NOT NULL,
	"fee_profile_json" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_payment_quotes_base_minimum" CHECK ("course_payment_quotes"."base_amount_in_cents" >= 1000),
	CONSTRAINT "course_payment_quotes_payment_method_required" CHECK ("course_payment_quotes"."allow_pix" or "course_payment_quotes"."allow_credit_card"),
	CONSTRAINT "course_payment_quotes_installment_count_valid" CHECK ("course_payment_quotes"."max_installment_count" between 1 and 12),
	CONSTRAINT "course_payment_quotes_expiration_valid" CHECK ("course_payment_quotes"."expires_at" > "course_payment_quotes"."generated_at"),
	CONSTRAINT "course_payment_quotes_environment_valid" CHECK ("course_payment_quotes"."provider_environment" in ('sandbox', 'production'))
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "payment_card_pricing_policy" "course_card_pricing_policy" DEFAULT 'buyer_pays_incremental_installment_cost' NOT NULL;--> statement-breakpoint
UPDATE "courses" SET "payment_card_pricing_policy" = 'seller_absorbs_all';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_purchase_flow" "provider_purchase_flow" DEFAULT 'checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "base_amount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "surcharge_amount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "installment_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "card_pricing_policy" "course_card_pricing_policy" DEFAULT 'seller_absorbs_all' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "target_net_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_net_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_fee_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_fee_percentage_basis_points" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_operation_fee_in_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "orders" SET "base_amount_in_cents" = "amount_in_cents";--> statement-breakpoint
ALTER TABLE "course_payment_quotes" ADD CONSTRAINT "course_payment_quotes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asaas_customer_mappings_identity_unique_idx" ON "asaas_customer_mappings" USING btree ("provider","identity_fingerprint","normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "asaas_customer_mappings_external_reference_unique_idx" ON "asaas_customer_mappings" USING btree ("provider","external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "asaas_customer_mappings_provider_customer_unique_idx" ON "asaas_customer_mappings" USING btree ("provider","provider_customer_id") WHERE "asaas_customer_mappings"."provider_customer_id" is not null;--> statement-breakpoint
CREATE INDEX "asaas_customer_mappings_status_idx" ON "asaas_customer_mappings" USING btree ("status","last_attempt_at");--> statement-breakpoint
CREATE INDEX "course_payment_quotes_signature_expires_idx" ON "course_payment_quotes" USING btree ("signature","expires_at");--> statement-breakpoint
CREATE INDEX "course_payment_quotes_course_expires_idx" ON "course_payment_quotes" USING btree ("course_id","expires_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_quote_id_course_payment_quotes_id_fk" FOREIGN KEY ("payment_quote_id") REFERENCES "public"."course_payment_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_payment_quote_idx" ON "orders" USING btree ("payment_quote_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_card_pricing_requires_card" CHECK ("courses"."payment_allow_credit_card" or "courses"."payment_card_pricing_policy" = 'seller_absorbs_all');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pricing_snapshot_consistent" CHECK ("orders"."base_amount_in_cents" >= 0
        and "orders"."surcharge_amount_in_cents" >= 0
        and "orders"."amount_in_cents" = "orders"."base_amount_in_cents" + "orders"."surcharge_amount_in_cents"
        and "orders"."installment_count" between 1 and 12
        and ("orders"."installment_count" > 1 or "orders"."surcharge_amount_in_cents" = 0)
        and ("orders"."card_pricing_policy" <> 'seller_absorbs_all' or "orders"."surcharge_amount_in_cents" = 0));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quoted_amounts_non_negative" CHECK (("orders"."target_net_amount_in_cents" is null or "orders"."target_net_amount_in_cents" >= 0)
        and ("orders"."quoted_net_amount_in_cents" is null or "orders"."quoted_net_amount_in_cents" >= 0)
        and ("orders"."quoted_fee_amount_in_cents" is null or "orders"."quoted_fee_amount_in_cents" >= 0)
        and ("orders"."quoted_fee_percentage_basis_points" is null or "orders"."quoted_fee_percentage_basis_points" >= 0)
        and ("orders"."quoted_operation_fee_in_cents" is null or "orders"."quoted_operation_fee_in_cents" >= 0));
