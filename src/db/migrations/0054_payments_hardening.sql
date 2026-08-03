CREATE TABLE "asaas_statement_import_cursors" (
	"range_key" text PRIMARY KEY NOT NULL,
	"start_date" text NOT NULL,
	"finish_date" text NOT NULL,
	"next_offset" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_by_user_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asaas_statement_import_cursor_offset_non_negative" CHECK ("asaas_statement_import_cursors"."next_offset" >= 0),
	CONSTRAINT "asaas_statement_import_cursor_status_valid" CHECK ("asaas_statement_import_cursors"."status" in ('running', 'completed')),
	CONSTRAINT "asaas_statement_import_cursor_completion_consistent" CHECK (("asaas_statement_import_cursors"."status" = 'completed') = ("asaas_statement_import_cursors"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "asaas_statement_import_cursors" ADD CONSTRAINT "asaas_statement_import_cursors_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "orders"
		WHERE "amount_in_cents" < 0
			OR "checkout_attempt_count" < 0
			OR coalesce("paid_amount_in_cents", 0) < 0
			OR coalesce("net_amount_in_cents", 0) < 0
			OR coalesce("fee_amount_in_cents", 0) < 0
			OR (
				"status" = 'paid'
				AND (
					"paid_at" IS NULL
					OR "paid_amount_in_cents" IS NULL
					OR ("provider_payment_id" IS NULL AND "provider_installment_id" IS NULL)
				)
			)
			OR (
				"status" = 'refunded'
				AND ("refunded_at" IS NULL OR "provider_refund_status" IS NULL)
			)
	) THEN
		RAISE EXCEPTION '0054 orders violate financial invariants';
	END IF;

	IF EXISTS (
		SELECT 1 FROM "refund_requests"
		WHERE "status" = 'confirmed'
			AND (
				"confirmed_at" IS NULL
				OR "provider_refund_status" IS NULL
				OR "provider_refunded_amount_in_cents" IS NULL
				OR "provider_refunded_amount_in_cents" <= 0
			)
	) THEN
		RAISE EXCEPTION '0054 refund requests violate confirmed evidence invariants';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_in_cents_non_negative" CHECK ("orders"."amount_in_cents" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_attempt_count_non_negative" CHECK ("orders"."checkout_attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_financial_amounts_non_negative" CHECK (("orders"."paid_amount_in_cents" is null or "orders"."paid_amount_in_cents" >= 0)
        and ("orders"."net_amount_in_cents" is null or "orders"."net_amount_in_cents" >= 0)
        and ("orders"."fee_amount_in_cents" is null or "orders"."fee_amount_in_cents" >= 0));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_evidence_consistent" CHECK ("orders"."status" <> 'paid'
        or (
          "orders"."paid_at" is not null
          and "orders"."paid_amount_in_cents" is not null
          and ("orders"."provider_payment_id" is not null or "orders"."provider_installment_id" is not null)
        ));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_evidence_consistent" CHECK ("orders"."status" <> 'refunded'
        or ("orders"."refunded_at" is not null and "orders"."provider_refund_status" is not null));--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_confirmed_evidence_consistent" CHECK ("refund_requests"."status" <> 'confirmed'
        or (
          "refund_requests"."confirmed_at" is not null
          and "refund_requests"."provider_refund_status" is not null
          and "refund_requests"."provider_refunded_amount_in_cents" > 0
        ));
