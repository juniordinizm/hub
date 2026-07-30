CREATE TABLE "asaas_financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"transaction_date" text NOT NULL,
	"transaction_type" text NOT NULL,
	"value_in_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asaas_financial_transactions_provider_id_unique_idx" ON "asaas_financial_transactions" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE INDEX "asaas_financial_transactions_date_idx" ON "asaas_financial_transactions" USING btree ("transaction_date");
