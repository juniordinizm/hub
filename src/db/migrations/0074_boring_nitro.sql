CREATE TYPE "public"."financial_event_source" AS ENUM('order', 'webhook', 'statement', 'refund', 'review', 'migration');--> statement-breakpoint
CREATE TABLE "financial_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "financial_event_source" NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"provider" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"order_id" uuid,
	"webhook_event_id" uuid,
	"refund_request_id" uuid,
	"payment_review_id" uuid,
	"actor_user_id" text,
	"provider_checkout_id" text,
	"provider_payment_id" text,
	"provider_installment_id" text,
	"provider_transaction_id" text,
	"order_status_before" text,
	"order_status_after" text,
	"checkout_status_before" text,
	"checkout_status_after" text,
	"provider_payment_status_before" text,
	"provider_payment_status_after" text,
	"refund_status_before" text,
	"refund_status_after" text,
	"payment_method" text,
	"amount_in_cents" integer,
	"value_in_cents" integer,
	"fee_amount_in_cents" integer,
	"net_amount_in_cents" integer,
	"refund_amount_in_cents" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_events_event_key_not_empty" CHECK (length(trim("financial_events"."event_key")) > 0),
	CONSTRAINT "financial_events_event_type_not_empty" CHECK (length(trim("financial_events"."event_type")) > 0),
	CONSTRAINT "financial_events_amounts_non_negative" CHECK (("financial_events"."amount_in_cents" is null or "financial_events"."amount_in_cents" >= 0)
        and ("financial_events"."fee_amount_in_cents" is null or "financial_events"."fee_amount_in_cents" >= 0)
        and ("financial_events"."net_amount_in_cents" is null or "financial_events"."net_amount_in_cents" >= 0)
        and ("financial_events"."refund_amount_in_cents" is null or "financial_events"."refund_amount_in_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_refund_request_id_refund_requests_id_fk" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_payment_review_id_payment_reviews_id_fk" FOREIGN KEY ("payment_review_id") REFERENCES "public"."payment_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_events" ADD CONSTRAINT "financial_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_events_provider_source_key_unique_idx" ON "financial_events" USING btree ("provider","source","event_key");--> statement-breakpoint
CREATE INDEX "financial_events_order_occurred_idx" ON "financial_events" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "financial_events_payment_occurred_idx" ON "financial_events" USING btree ("provider_payment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "financial_events_transaction_idx" ON "financial_events" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE INDEX "financial_events_occurred_idx" ON "financial_events" USING btree ("occurred_at");--> statement-breakpoint
INSERT INTO financial_events (
  source,
  event_key,
  event_type,
  provider,
  occurred_at,
  order_id,
  provider_checkout_id,
  provider_payment_id,
  provider_installment_id,
  order_status_after,
  checkout_status_after,
  provider_payment_status_after,
  refund_status_after,
  payment_method,
  amount_in_cents,
  value_in_cents,
  fee_amount_in_cents,
  net_amount_in_cents,
  metadata
)
SELECT
  'migration'::financial_event_source,
  'order:' || o.id::text,
  'order.snapshot_imported',
  o.provider,
  coalesce(o.paid_at, o.created_at, now()),
  o.id,
  o.provider_checkout_id,
  o.provider_payment_id,
  o.provider_installment_id,
  o.status::text,
  o.checkout_status::text,
  o.provider_payment_status,
  o.provider_refund_status,
  o.payment_method,
  o.amount_in_cents,
  coalesce(o.paid_amount_in_cents, o.amount_in_cents),
  o.fee_amount_in_cents,
  o.net_amount_in_cents,
  jsonb_build_object('backfill', true, 'kind', 'order_snapshot')
FROM orders o
ON CONFLICT (provider, source, event_key) DO NOTHING;--> statement-breakpoint
INSERT INTO financial_events (
  source,
  event_key,
  event_type,
  provider,
  occurred_at,
  order_id,
  webhook_event_id,
  provider_checkout_id,
  provider_payment_id,
  provider_installment_id,
  provider_payment_status_after,
  metadata
)
SELECT
  'webhook'::financial_event_source,
  w.event_key,
  w.event_name,
  w.provider,
  w.created_at,
  w.order_id,
  w.id,
  coalesce(w.payload #>> '{checkout,id}', w.payload #>> '{payment,checkoutSession}'),
  w.payload #>> '{payment,id}',
  w.payload #>> '{payment,installment}',
  w.payload #>> '{payment,status}',
  jsonb_build_object(
    'backfill', true,
    'kind', 'webhook',
    'webhookStatus', w.status::text
  )
FROM webhook_events w
ON CONFLICT (provider, source, event_key) DO NOTHING;--> statement-breakpoint
INSERT INTO financial_events (
  source,
  event_key,
  event_type,
  provider,
  occurred_at,
  provider_transaction_id,
  value_in_cents,
  metadata
)
SELECT
  'statement'::financial_event_source,
  t.provider_transaction_id,
  'statement.transaction_imported',
  'asaas',
  CASE
    WHEN t.transaction_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN t.transaction_date::date AT TIME ZONE 'UTC'
    ELSE t.created_at
  END,
  t.provider_transaction_id,
  t.value_in_cents,
  jsonb_build_object(
    'backfill', true,
    'kind', 'statement_transaction',
    'transactionDate', t.transaction_date,
    'transactionType', t.transaction_type
  )
FROM asaas_financial_transactions t
ON CONFLICT (provider, source, event_key) DO NOTHING;--> statement-breakpoint
INSERT INTO financial_events (
  source,
  event_key,
  event_type,
  provider,
  occurred_at,
  order_id,
  refund_request_id,
  actor_user_id,
  provider_payment_id,
  provider_installment_id,
  refund_status_after,
  refund_amount_in_cents,
  metadata
)
SELECT
  'migration'::financial_event_source,
  'refund:' || r.id::text,
  'refund.snapshot_imported',
  coalesce(o.provider, 'asaas'),
  coalesce(r.confirmed_at, r.updated_at, r.created_at),
  r.order_id,
  r.id,
  r.requested_by_user_id,
  o.provider_payment_id,
  o.provider_installment_id,
  r.status::text,
  r.provider_refunded_amount_in_cents,
  jsonb_build_object('backfill', true, 'kind', 'refund_snapshot')
FROM refund_requests r
LEFT JOIN orders o ON o.id = r.order_id
ON CONFLICT (provider, source, event_key) DO NOTHING;--> statement-breakpoint
INSERT INTO financial_events (
  source,
  event_key,
  event_type,
  provider,
  occurred_at,
  order_id,
  payment_review_id,
  actor_user_id,
  metadata
)
SELECT
  'migration'::financial_event_source,
  'review:' || r.id::text,
  'payment_review.snapshot_imported',
  coalesce(o.provider, 'asaas'),
  coalesce(r.resolved_at, r.updated_at, r.created_at),
  r.order_id,
  r.id,
  coalesce(r.resolved_by_user_id, r.executed_by_user_id, r.approved_by_user_id),
  jsonb_build_object(
    'backfill', true,
    'kind', 'payment_review_snapshot',
    'reviewType', r.type::text,
    'reviewStatus', r.status::text
  )
FROM payment_reviews r
LEFT JOIN orders o ON o.id = r.order_id
ON CONFLICT (provider, source, event_key) DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_financial_order_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  event_type text;
  old_checkout_status text;
  old_order_status text;
  old_payment_status text;
  old_refund_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
  ELSE
    IF NOT (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.checkout_status IS DISTINCT FROM NEW.checkout_status
      OR OLD.checkout_url IS DISTINCT FROM NEW.checkout_url
      OR OLD.checkout_attempt_count IS DISTINCT FROM NEW.checkout_attempt_count
      OR OLD.checkout_last_attempt_at IS DISTINCT FROM NEW.checkout_last_attempt_at
      OR OLD.checkout_next_attempt_at IS DISTINCT FROM NEW.checkout_next_attempt_at
      OR OLD.checkout_error_message IS DISTINCT FROM NEW.checkout_error_message
      OR OLD.provider_checkout_id IS DISTINCT FROM NEW.provider_checkout_id
      OR OLD.provider_payment_id IS DISTINCT FROM NEW.provider_payment_id
      OR OLD.provider_installment_id IS DISTINCT FROM NEW.provider_installment_id
      OR OLD.provider_checkout_status IS DISTINCT FROM NEW.provider_checkout_status
      OR OLD.provider_payment_status IS DISTINCT FROM NEW.provider_payment_status
      OR OLD.provider_risk_status IS DISTINCT FROM NEW.provider_risk_status
      OR OLD.provider_settlement_status IS DISTINCT FROM NEW.provider_settlement_status
      OR OLD.provider_refund_status IS DISTINCT FROM NEW.provider_refund_status
      OR OLD.provider_dispute_status IS DISTINCT FROM NEW.provider_dispute_status
      OR OLD.amount_in_cents IS DISTINCT FROM NEW.amount_in_cents
      OR OLD.paid_amount_in_cents IS DISTINCT FROM NEW.paid_amount_in_cents
      OR OLD.net_amount_in_cents IS DISTINCT FROM NEW.net_amount_in_cents
      OR OLD.fee_amount_in_cents IS DISTINCT FROM NEW.fee_amount_in_cents
      OR OLD.payment_method IS DISTINCT FROM NEW.payment_method
      OR OLD.payment_installment_count IS DISTINCT FROM NEW.payment_installment_count
    ) THEN
      RETURN NEW;
    END IF;

    old_order_status := OLD.status::text;
    old_checkout_status := OLD.checkout_status::text;
    old_payment_status := OLD.provider_payment_status;
    old_refund_status := OLD.provider_refund_status;
    event_type := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'order.status_changed'
      WHEN OLD.checkout_status IS DISTINCT FROM NEW.checkout_status
        OR OLD.checkout_url IS DISTINCT FROM NEW.checkout_url
        OR OLD.checkout_attempt_count IS DISTINCT FROM NEW.checkout_attempt_count
        OR OLD.checkout_last_attempt_at IS DISTINCT FROM NEW.checkout_last_attempt_at
        OR OLD.checkout_next_attempt_at IS DISTINCT FROM NEW.checkout_next_attempt_at
        OR OLD.checkout_error_message IS DISTINCT FROM NEW.checkout_error_message
        OR OLD.provider_checkout_id IS DISTINCT FROM NEW.provider_checkout_id
        OR OLD.provider_checkout_status IS DISTINCT FROM NEW.provider_checkout_status
        THEN 'checkout.updated'
      WHEN OLD.provider_refund_status IS DISTINCT FROM NEW.provider_refund_status
        THEN 'refund.evidence_updated'
      WHEN OLD.provider_dispute_status IS DISTINCT FROM NEW.provider_dispute_status
        THEN 'dispute.evidence_updated'
      ELSE 'payment.evidence_updated'
    END;
  END IF;

  INSERT INTO financial_events (
    source,
    event_key,
    event_type,
    provider,
    occurred_at,
    order_id,
    provider_checkout_id,
    provider_payment_id,
    provider_installment_id,
    order_status_before,
    order_status_after,
    checkout_status_before,
    checkout_status_after,
    provider_payment_status_before,
    provider_payment_status_after,
    refund_status_before,
    refund_status_after,
    payment_method,
    amount_in_cents,
    value_in_cents,
    fee_amount_in_cents,
    net_amount_in_cents,
    metadata
  )
  VALUES (
    'order'::financial_event_source,
    'order:' || NEW.id::text || ':' || gen_random_uuid()::text,
    event_type,
    NEW.provider,
    coalesce(NEW.updated_at, now()),
    NEW.id,
    NEW.provider_checkout_id,
    NEW.provider_payment_id,
    NEW.provider_installment_id,
    old_order_status,
    NEW.status::text,
    old_checkout_status,
    NEW.checkout_status::text,
    old_payment_status,
    NEW.provider_payment_status,
    old_refund_status,
    NEW.provider_refund_status,
    NEW.payment_method,
    NEW.amount_in_cents,
    coalesce(NEW.paid_amount_in_cents, NEW.amount_in_cents),
    NEW.fee_amount_in_cents,
    NEW.net_amount_in_cents,
    jsonb_build_object(
      'operation', TG_OP,
      'providerCheckoutStatus', NEW.provider_checkout_status,
      'providerRiskStatus', NEW.provider_risk_status,
      'providerSettlementStatus', NEW.provider_settlement_status,
      'providerDisputeStatus', NEW.provider_dispute_status,
      'paymentInstallmentCount', NEW.payment_installment_count
    )
  );

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_financial_event_after_write ON orders;--> statement-breakpoint
CREATE TRIGGER orders_financial_event_after_write
AFTER INSERT OR UPDATE OF
  status,
  checkout_status,
  checkout_url,
  checkout_attempt_count,
  checkout_last_attempt_at,
  checkout_next_attempt_at,
  checkout_error_message,
  provider_checkout_id,
  provider_payment_id,
  provider_installment_id,
  provider_checkout_status,
  provider_payment_status,
  provider_risk_status,
  provider_settlement_status,
  provider_refund_status,
  provider_dispute_status,
  amount_in_cents,
  paid_amount_in_cents,
  net_amount_in_cents,
  fee_amount_in_cents,
  payment_method,
  payment_installment_count
ON orders
FOR EACH ROW
EXECUTE FUNCTION record_financial_order_event();--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_financial_webhook_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.order_id IS NOT DISTINCT FROM NEW.order_id THEN
      RETURN NEW;
    END IF;

    INSERT INTO financial_events (
      source,
      event_key,
      event_type,
      provider,
      occurred_at,
      order_id,
      webhook_event_id,
      provider_checkout_id,
      provider_payment_id,
      provider_installment_id,
      provider_payment_status_after,
      metadata
    )
    VALUES (
      'webhook'::financial_event_source,
      NEW.event_key || ':order:' || coalesce(NEW.order_id::text, 'none'),
      'webhook.associated',
      NEW.provider,
      NEW.created_at,
      NEW.order_id,
      NEW.id,
      coalesce(NEW.payload #>> '{checkout,id}', NEW.payload #>> '{payment,checkoutSession}'),
      NEW.payload #>> '{payment,id}',
      NEW.payload #>> '{payment,installment}',
      NEW.payload #>> '{payment,status}',
      jsonb_build_object(
        'previousOrderId', OLD.order_id,
        'webhookStatus', NEW.status::text,
        'payloadSanitized', NEW.payload_sanitized_at is not null
      )
    )
    ON CONFLICT (provider, source, event_key) DO NOTHING;

    RETURN NEW;
  END IF;

  INSERT INTO financial_events (
    source,
    event_key,
    event_type,
    provider,
    occurred_at,
    order_id,
    webhook_event_id,
    provider_checkout_id,
    provider_payment_id,
    provider_installment_id,
    provider_payment_status_after,
    metadata
  )
  VALUES (
    'webhook'::financial_event_source,
    NEW.event_key,
    NEW.event_name,
    NEW.provider,
    NEW.created_at,
    NEW.order_id,
    NEW.id,
    coalesce(NEW.payload #>> '{checkout,id}', NEW.payload #>> '{payment,checkoutSession}'),
    NEW.payload #>> '{payment,id}',
    NEW.payload #>> '{payment,installment}',
    NEW.payload #>> '{payment,status}',
    jsonb_build_object(
      'webhookStatus', NEW.status::text,
      'payloadSanitized', NEW.payload_sanitized_at is not null
    )
  )
  ON CONFLICT (provider, source, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS webhook_events_financial_event_after_write ON webhook_events;--> statement-breakpoint
CREATE TRIGGER webhook_events_financial_event_after_write
AFTER INSERT OR UPDATE OF order_id ON webhook_events
FOR EACH ROW
EXECUTE FUNCTION record_financial_webhook_event();--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_financial_statement_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.transaction_date IS DISTINCT FROM NEW.transaction_date
      OR OLD.transaction_type IS DISTINCT FROM NEW.transaction_type
      OR OLD.value_in_cents IS DISTINCT FROM NEW.value_in_cents
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO financial_events (
      source,
      event_key,
      event_type,
      provider,
      occurred_at,
      provider_transaction_id,
      value_in_cents,
      metadata
    )
    VALUES (
      'statement'::financial_event_source,
      'transaction:' || NEW.provider_transaction_id || ':' || md5(concat_ws('|', NEW.transaction_date, NEW.transaction_type, NEW.value_in_cents::text)),
      'statement.transaction_recorded',
      'asaas',
      CASE
        WHEN NEW.transaction_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN NEW.transaction_date::date AT TIME ZONE 'UTC'
        ELSE NEW.created_at
      END,
      NEW.provider_transaction_id,
      NEW.value_in_cents,
      jsonb_build_object(
        'transactionDate', NEW.transaction_date,
        'transactionType', NEW.transaction_type
      )
    )
    ON CONFLICT (provider, source, event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS asaas_financial_transactions_event_after_write ON asaas_financial_transactions;--> statement-breakpoint
CREATE TRIGGER asaas_financial_transactions_event_after_write
AFTER INSERT OR UPDATE OF transaction_date, transaction_type, value_in_cents
ON asaas_financial_transactions
FOR EACH ROW
EXECUTE FUNCTION record_financial_statement_event();--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_financial_refund_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_refund_status text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.requested_by_user_id IS DISTINCT FROM NEW.requested_by_user_id
      OR OLD.reason IS DISTINCT FROM NEW.reason
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.provider_refund_status IS DISTINCT FROM NEW.provider_refund_status
      OR OLD.provider_refund_created_at IS DISTINCT FROM NEW.provider_refund_created_at
      OR OLD.provider_refund_end_to_end_id IS DISTINCT FROM NEW.provider_refund_end_to_end_id
      OR OLD.provider_refunded_amount_in_cents IS DISTINCT FROM NEW.provider_refunded_amount_in_cents
      OR OLD.error_message IS DISTINCT FROM NEW.error_message
      OR OLD.confirmed_at IS DISTINCT FROM NEW.confirmed_at
    ) THEN
      RETURN NEW;
    END IF;
    old_refund_status := OLD.status::text;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO financial_events (
      source,
      event_key,
      event_type,
      provider,
      occurred_at,
      order_id,
      refund_request_id,
      actor_user_id,
      provider_payment_id,
      provider_installment_id,
      refund_status_before,
      refund_status_after,
      refund_amount_in_cents,
      metadata
    )
    SELECT
      'refund'::financial_event_source,
      'refund:' || NEW.id::text || ':' || md5(concat_ws('|', NEW.requested_by_user_id, NEW.reason, NEW.status::text, NEW.provider_refund_status, NEW.provider_refund_created_at, NEW.provider_refund_end_to_end_id, NEW.provider_refunded_amount_in_cents::text, NEW.error_message, NEW.confirmed_at::text)),
      'refund_request.' || NEW.status::text,
      coalesce(o.provider, 'asaas'),
      coalesce(NEW.confirmed_at, NEW.updated_at, NEW.created_at),
      NEW.order_id,
      NEW.id,
      NEW.requested_by_user_id,
      o.provider_payment_id,
      o.provider_installment_id,
      old_refund_status,
      NEW.status::text,
      NEW.provider_refunded_amount_in_cents,
      jsonb_build_object(
        'providerRefundStatus', NEW.provider_refund_status,
        'providerRefundCreatedAt', NEW.provider_refund_created_at,
        'providerRefundEndToEndId', NEW.provider_refund_end_to_end_id,
        'errorCode', NEW.error_message
      )
    FROM orders o
    WHERE o.id = NEW.order_id
    ON CONFLICT (provider, source, event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS refund_requests_financial_event_after_write ON refund_requests;--> statement-breakpoint
CREATE TRIGGER refund_requests_financial_event_after_write
AFTER INSERT OR UPDATE OF
  requested_by_user_id,
  reason,
  status,
  provider_refund_status,
  provider_refund_created_at,
  provider_refund_end_to_end_id,
  provider_refunded_amount_in_cents,
  error_message,
  confirmed_at
ON refund_requests
FOR EACH ROW
EXECUTE FUNCTION record_financial_refund_event();--> statement-breakpoint
CREATE OR REPLACE FUNCTION record_financial_review_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      OLD.type IS DISTINCT FROM NEW.type
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.reason IS DISTINCT FROM NEW.reason
      OR OLD.decision_reason IS DISTINCT FROM NEW.decision_reason
      OR OLD.resolved_by_user_id IS DISTINCT FROM NEW.resolved_by_user_id
      OR OLD.resolved_at IS DISTINCT FROM NEW.resolved_at
      OR OLD.approved_by_user_id IS DISTINCT FROM NEW.approved_by_user_id
      OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
      OR OLD.executed_by_user_id IS DISTINCT FROM NEW.executed_by_user_id
      OR OLD.executed_at IS DISTINCT FROM NEW.executed_at
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO financial_events (
      source,
      event_key,
      event_type,
      provider,
      occurred_at,
      order_id,
      payment_review_id,
      actor_user_id,
      metadata
    )
    SELECT
      'review'::financial_event_source,
      'review:' || NEW.id::text || ':' || md5(concat_ws('|', NEW.type::text, NEW.status::text, NEW.reason, NEW.decision_reason, NEW.resolved_by_user_id, NEW.resolved_at::text, NEW.approved_by_user_id, NEW.approved_at::text, NEW.executed_by_user_id, NEW.executed_at::text)),
      CASE WHEN TG_OP = 'INSERT' THEN 'payment_review.created' ELSE 'payment_review.' || NEW.status::text END,
      coalesce(o.provider, 'asaas'),
      coalesce(NEW.resolved_at, NEW.updated_at, NEW.created_at),
      NEW.order_id,
      NEW.id,
      coalesce(NEW.resolved_by_user_id, NEW.executed_by_user_id, NEW.approved_by_user_id),
      jsonb_build_object(
        'reviewType', NEW.type::text,
        'reviewStatus', NEW.status::text
      )
    FROM orders o
    WHERE o.id = NEW.order_id
    ON CONFLICT (provider, source, event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_reviews_financial_event_after_write ON payment_reviews;--> statement-breakpoint
CREATE TRIGGER payment_reviews_financial_event_after_write
AFTER INSERT OR UPDATE OF
  type,
  status,
  reason,
  decision_reason,
  resolved_by_user_id,
  resolved_at,
  approved_by_user_id,
  approved_at,
  executed_by_user_id,
  executed_at
ON payment_reviews
FOR EACH ROW
EXECUTE FUNCTION record_financial_review_event();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_financial_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      (OLD.order_id IS NOT NULL AND NEW.order_id IS NULL)
      OR (OLD.webhook_event_id IS NOT NULL AND NEW.webhook_event_id IS NULL)
      OR (OLD.refund_request_id IS NOT NULL AND NEW.refund_request_id IS NULL)
      OR (OLD.payment_review_id IS NOT NULL AND NEW.payment_review_id IS NULL)
      OR (OLD.actor_user_id IS NOT NULL AND NEW.actor_user_id IS NULL)
    )
    AND (
      to_jsonb(OLD) - ARRAY['order_id', 'webhook_event_id', 'refund_request_id', 'payment_review_id', 'actor_user_id']
    ) = (
      to_jsonb(NEW) - ARRAY['order_id', 'webhook_event_id', 'refund_request_id', 'payment_review_id', 'actor_user_id']
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'financial_events is append-only';
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS financial_events_append_only ON financial_events;--> statement-breakpoint
CREATE TRIGGER financial_events_append_only
BEFORE UPDATE OR DELETE ON financial_events
FOR EACH ROW
EXECUTE FUNCTION prevent_financial_event_mutation();
