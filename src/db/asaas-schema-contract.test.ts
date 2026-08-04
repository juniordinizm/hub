import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  asaasCustomerMappingStatusEnum,
  asaasCustomerMappings,
  asaasStatementImportCursors,
  buyerIdentityStatusEnum,
  checkoutStatusEnum,
  courseCardPricingPolicyEnum,
  coursePaymentQuotes,
  courses,
  enrollmentGrantSourceTypeEnum,
  enrollmentGrants,
  orderStatusEnum,
  orders,
  paymentReviews,
  paymentReviewTypeEnum,
  providerPurchaseFlowEnum,
  publicCheckoutRateLimits,
  refundRequestStatusEnum,
  refundRequests,
  webhookEvents,
  webhookStatusEnum,
} from "./schema";

const NEWLINE_PATTERN = /\r?\n/;
const RENAME_COLUMN_PATTERN = /RENAME COLUMN/i;
const CLEAR_IP_COLUMN_PATTERN = /\bip(?:_address)?\b/i;
const DESTRUCTIVE_PAYMENT_DELETE_PATTERN =
  /delete\s+from\s+(orders|refund_requests)/i;
const RAISE_EXCEPTION_PATTERN = /raise exception/i;

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name);

const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((tableIndex) => tableIndex.config.name);

const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map((tableCheck) => tableCheck.name);

describe("Asaas persistence contract", () => {
  it("persists coordinated public checkout limits without clear IP data", async () => {
    expect(columnNames(publicCheckoutRateLimits)).toEqual([
      "key_hash",
      "window_started_at",
      "request_count",
      "expires_at",
      "created_at",
      "updated_at",
    ]);
    expect(indexNames(publicCheckoutRateLimits)).toContain(
      "public_checkout_rate_limits_expires_at_idx"
    );

    const migration = await readFile(
      "src/db/migrations/0048_asaas_public_checkout_rate_limit.sql",
      "utf8"
    );
    expect(migration).toContain('CREATE TABLE "public_checkout_rate_limits"');
    expect(migration).toContain('"key_hash" text PRIMARY KEY NOT NULL');
    expect(migration).not.toMatch(CLEAR_IP_COLUMN_PATTERN);
  });

  it("keeps commercial courses provider-neutral and enforces the minimum paid price", () => {
    expect(columnNames(courses)).not.toContain("payment_provider_product_id");
    expect(checkNames(courses)).toContain(
      "courses_price_in_cents_zero_or_minimum"
    );
  });

  it("persists automatic installment pricing without changing historical offers", async () => {
    expect(courseCardPricingPolicyEnum.enumValues).toEqual([
      "seller_absorbs_all",
      "buyer_pays_incremental_installment_cost",
    ]);
    expect(providerPurchaseFlowEnum.enumValues).toEqual([
      "checkout",
      "invoice",
    ]);
    expect(asaasCustomerMappingStatusEnum.enumValues).toEqual([
      "pending",
      "creating",
      "ready",
      "uncertain",
      "failed",
    ]);
    expect(columnNames(courses)).toContain("payment_card_pricing_policy");
    expect(columnNames(coursePaymentQuotes)).toEqual(
      expect.arrayContaining([
        "id",
        "course_id",
        "signature",
        "provider_environment",
        "base_amount_in_cents",
        "card_pricing_policy",
        "options_json",
        "fee_profile_json",
        "generated_at",
        "expires_at",
      ])
    );
    expect(indexNames(coursePaymentQuotes)).toContain(
      "course_payment_quotes_signature_expires_idx"
    );
    expect(columnNames(asaasCustomerMappings)).not.toContain("cpf_cnpj");
    expect(indexNames(asaasCustomerMappings)).toEqual(
      expect.arrayContaining([
        "asaas_customer_mappings_identity_unique_idx",
        "asaas_customer_mappings_provider_customer_unique_idx",
      ])
    );
    expect(columnNames(orders)).toEqual(
      expect.arrayContaining([
        "provider_purchase_flow",
        "payment_quote_id",
        "base_amount_in_cents",
        "surcharge_amount_in_cents",
        "installment_count",
        "card_pricing_policy",
        "target_net_amount_in_cents",
        "quoted_net_amount_in_cents",
        "quoted_fee_amount_in_cents",
        "quoted_fee_percentage_basis_points",
        "quoted_operation_fee_in_cents",
        "quoted_at",
      ])
    );
    expect(checkNames(orders)).toContain("orders_pricing_snapshot_consistent");

    const migration = await readFile(
      new URL(
        "./migrations/0056_asaas_installment_pricing.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(migration).toContain(
      'UPDATE "courses" SET "payment_card_pricing_policy" = \'seller_absorbs_all\''
    );
    expect(migration).toContain(
      'UPDATE "orders" SET "base_amount_in_cents" = "amount_in_cents"'
    );
    expect(migration).not.toMatch(DESTRUCTIVE_PAYMENT_DELETE_PATTERN);
  });

  it("uses a provider-neutral paid order as the access grant source", () => {
    expect(enrollmentGrantSourceTypeEnum.enumValues).toEqual([
      "paid_order",
      "manual",
    ]);
    expect(checkNames(enrollmentGrants)).toContain(
      "enrollment_grants_source_shape_check"
    );
  });

  it("persists explicit buyer identity resolution state", () => {
    expect(buyerIdentityStatusEnum.enumValues).toEqual([
      "pending",
      "resolved",
      "review_required",
    ]);
    expect(paymentReviewTypeEnum.enumValues).toContain("buyer_identity");
    expect(columnNames(orders)).toContain("buyer_identity_status");
    expect(orders.buyerIdentityStatus.notNull).toBe(true);
  });

  it("keeps the canonical order state separate from external lifecycles", () => {
    expect(orderStatusEnum.enumValues).toEqual([
      "pending",
      "paid",
      "refunded",
      "disputed",
      "cancelled",
    ]);
    expect(checkoutStatusEnum.enumValues).toEqual([
      "pending",
      "creating",
      "active",
      "failed",
      "uncertain",
      "cancelled",
      "expired",
    ]);

    expect(columnNames(orders)).toEqual(
      expect.arrayContaining([
        "provider_checkout_id",
        "provider_payment_id",
        "provider_customer_id",
        "checkout_status",
        "checkout_url",
        "checkout_attempt_count",
        "checkout_last_attempt_at",
        "checkout_next_attempt_at",
        "checkout_error_message",
        "provider_checkout_status",
        "provider_payment_status",
        "provider_risk_status",
        "provider_settlement_status",
        "provider_refund_status",
        "provider_dispute_status",
      ])
    );
    expect(columnNames(orders)).not.toContain("provider_order_id");
    expect(orders.provider.notNull).toBe(true);
    expect(orders.provider.hasDefault).toBe(false);
    expect(orders.providerCheckoutId.notNull).toBe(false);
    expect(orders.checkoutAttemptCount.default).toBe(0);
    expect(indexNames(orders)).toEqual(
      expect.arrayContaining([
        "orders_provider_checkout_unique_idx",
        "orders_provider_payment_unique_idx",
        "orders_checkout_retry_idx",
      ])
    );
    expect(checkNames(orders)).toEqual(
      expect.arrayContaining([
        "orders_amount_in_cents_non_negative",
        "orders_checkout_attempt_count_non_negative",
        "orders_financial_amounts_non_negative",
        "orders_paid_evidence_consistent",
        "orders_refunded_evidence_consistent",
      ])
    );
  });

  it("persists mandatory checkout item snapshots on the order", async () => {
    expect(columnNames(orders)).toEqual(
      expect.arrayContaining([
        "checkout_course_slug",
        "checkout_item_name",
        "checkout_item_description",
      ])
    );
    expect(orders.checkoutCourseSlug.notNull).toBe(true);
    expect(orders.checkoutItemName.notNull).toBe(true);
    expect(orders.checkoutItemDescription.notNull).toBe(true);

    const migration = await readFile(
      new URL(
        "./migrations/0046_order_checkout_item_snapshot.sql",
        import.meta.url
      ),
      "utf8"
    );
    const statements = migration.split(NEWLINE_PATTERN);

    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "orders" ADD COLUMN "checkout_item_name" text NOT NULL;--> statement-breakpoint',
        'ALTER TABLE "orders" ADD COLUMN "checkout_item_description" text NOT NULL;',
      ])
    );
    expect(migration).not.toMatch(RENAME_COLUMN_PATTERN);

    const slugMigration = await readFile(
      new URL(
        "./migrations/0047_order_checkout_course_slug_snapshot.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(slugMigration).toBe(
      'ALTER TABLE "orders" ADD COLUMN "checkout_course_slug" text NOT NULL;'
    );
    expect(slugMigration).not.toMatch(RENAME_COLUMN_PATTERN);
  });

  it("models webhook ingestion as a retryable inbox with 30-day payload retention", () => {
    expect(webhookStatusEnum.enumValues).toEqual([
      "received",
      "processing",
      "processed",
      "ignored",
      "retryable",
      "failed",
    ]);
    expect(columnNames(webhookEvents)).toEqual(
      expect.arrayContaining([
        "order_id",
        "attempt_count",
        "last_attempt_at",
        "next_attempt_at",
        "locked_at",
        "locked_by",
        "payload_expires_at",
        "payload_sanitized_at",
      ])
    );
    expect(webhookEvents.provider.notNull).toBe(true);
    expect(webhookEvents.provider.hasDefault).toBe(false);
    expect(webhookEvents.orderId.notNull).toBe(false);
    expect(webhookEvents.attemptCount.default).toBe(0);
    expect(webhookEvents.payloadExpiresAt.notNull).toBe(true);
    expect(webhookEvents.payloadExpiresAt.hasDefault).toBe(true);
    expect(indexNames(webhookEvents)).toEqual(
      expect.arrayContaining([
        "webhook_events_status_retry_idx",
        "webhook_events_order_idx",
      ])
    );
  });

  it("represents uncertain refunds and actionable payment anomalies", () => {
    expect(refundRequestStatusEnum.enumValues).toEqual([
      "requested",
      "processing",
      "uncertain",
      "failed",
      "confirmed",
    ]);
    expect(paymentReviewTypeEnum.enumValues).toEqual([
      "amount_mismatch",
      "terminal_conflict",
      "event_anomaly",
      "partial_refund",
      "uncertain_result",
      "buyer_identity",
    ]);
    expect(indexNames(paymentReviews)).toContain(
      "payment_reviews_webhook_event_unique_idx"
    );

    expect(columnNames(refundRequests)).not.toContain("provider_refund_id");
    expect(columnNames(refundRequests)).toEqual(
      expect.arrayContaining([
        "provider_refund_status",
        "provider_refund_created_at",
        "provider_refund_end_to_end_id",
        "provider_refund_receipt_url",
        "provider_refunded_amount_in_cents",
      ])
    );
    expect(checkNames(refundRequests)).toContain(
      "refund_requests_provider_amount_positive"
    );
    expect(checkNames(refundRequests)).toContain(
      "refund_requests_confirmed_evidence_consistent"
    );
    expect(refundRequests.providerRefundStatus.notNull).toBe(false);
    expect(refundRequests.providerRefundCreatedAt.notNull).toBe(false);
    expect(refundRequests.providerRefundEndToEndId.notNull).toBe(false);
    expect(refundRequests.providerRefundReceiptUrl.notNull).toBe(false);
    expect(refundRequests.providerRefundedAmountInCents.notNull).toBe(false);
  });

  it("persists a resumable statement import cursor with explicit invariants", async () => {
    expect(columnNames(asaasStatementImportCursors)).toEqual([
      "range_key",
      "start_date",
      "finish_date",
      "next_offset",
      "status",
      "started_by_user_id",
      "completed_at",
      "created_at",
      "updated_at",
    ]);
    expect(checkNames(asaasStatementImportCursors)).toEqual(
      expect.arrayContaining([
        "asaas_statement_import_cursor_offset_non_negative",
        "asaas_statement_import_cursor_status_valid",
        "asaas_statement_import_cursor_completion_consistent",
      ])
    );
    const migration = await readFile(
      new URL("./migrations/0054_payments_hardening.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toMatch(RAISE_EXCEPTION_PATTERN);
    expect(migration).not.toMatch(DESTRUCTIVE_PAYMENT_DELETE_PATTERN);
    expect(migration).toContain('"paid_amount_in_cents" IS NULL');
    expect(migration).not.toContain(
      '"paid_amount_in_cents" IS DISTINCT FROM "amount_in_cents"'
    );
  });

  it("deduplicates financial review by durable webhook identity", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0049_payment_review_webhook_idempotency.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "payment_reviews_webhook_event_unique_idx"'
    );
    expect(migration).toContain('("webhook_event_id")');
    expect(migration).toContain(
      'WHERE "payment_reviews"."webhook_event_id" is not null'
    );
  });

  it("migrates existing identifiers and grant sources without destructive enum recreation", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0044_asaas_commerce_persistence.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      'RENAME COLUMN "provider_order_id" TO "provider_checkout_id"'
    );
    expect(migration).toContain(
      'ALTER COLUMN "provider_checkout_id" DROP NOT NULL'
    );
    expect(migration).toContain(
      "RENAME VALUE 'abacatepay_order' TO 'paid_order'"
    );
    expect(migration).not.toContain(
      'DROP TYPE "public"."enrollment_grant_source_type"'
    );
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain('DROP COLUMN "payment_provider_product_id"');
  });

  it("stores real refund evidence without inventing an external refund identifier", async () => {
    const migration = await readFile(
      new URL("./migrations/0045_asaas_refund_evidence.sql", import.meta.url),
      "utf8"
    );
    const statements = migration.split(NEWLINE_PATTERN);

    expect(statements).toEqual(
      expect.arrayContaining([
        'ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_status" text;--> statement-breakpoint',
        'ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_created_at" text;--> statement-breakpoint',
        'ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_end_to_end_id" text;--> statement-breakpoint',
        'ALTER TABLE "refund_requests" ADD COLUMN "provider_refund_receipt_url" text;--> statement-breakpoint',
        'ALTER TABLE "refund_requests" ADD COLUMN "provider_refunded_amount_in_cents" integer;--> statement-breakpoint',
      ])
    );
    expect(migration).toContain('DROP COLUMN "provider_refund_id"');
    expect(migration).toContain(
      'CONSTRAINT "refund_requests_provider_amount_positive" CHECK ("refund_requests"."provider_refunded_amount_in_cents" is null or "refund_requests"."provider_refunded_amount_in_cents" > 0)'
    );
    expect(migration).not.toContain(
      'ALTER COLUMN "provider_refunded_amount_in_cents" SET NOT NULL'
    );
  });
});
