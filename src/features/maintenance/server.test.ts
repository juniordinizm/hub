import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  pruneEmailDeliveryRecords: vi.fn().mockResolvedValue({
    events: 0,
    messages: 0,
  }),
  reconcileCertificateTemplateAssets: vi.fn(),
  reconcileRevokedCertificateArtifacts: vi.fn(),
  reconcileStagedAdminImageUploads: vi.fn(),
  reconcileExpiredLessonResourceUploads: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/email-delivery/server", () => ({
  pruneEmailDeliveryRecords: dependencies.pruneEmailDeliveryRecords,
}));
vi.mock("@/features/certificates/artifact-reconciliation", () => ({
  reconcileRevokedCertificateArtifacts:
    dependencies.reconcileRevokedCertificateArtifacts,
}));
vi.mock("@/features/certificates/template-asset-cleanup", () => ({
  reconcileCertificateTemplateAssets:
    dependencies.reconcileCertificateTemplateAssets,
}));
vi.mock("@/features/storage/staged-image-reconciliation", () => ({
  reconcileStagedAdminImageUploads:
    dependencies.reconcileStagedAdminImageUploads,
}));
vi.mock("@/features/storage/lesson-resource-upload-cleanup", () => ({
  reconcileExpiredLessonResourceUploads:
    dependencies.reconcileExpiredLessonResourceUploads,
}));

import { runMaintenance } from "./server";

describe("runMaintenance", () => {
  it("does not mutate data after its invocation deadline", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      runMaintenance({ clock: () => 500, deadlineAt: 500 })
    ).resolves.toMatchObject({
      deadlineReached: true,
      leaseLost: false,
    });

    expect(query).not.toHaveBeenCalled();
    expect(
      dependencies.reconcileRevokedCertificateArtifacts
    ).not.toHaveBeenCalled();
  });

  it("does not mutate data after losing its durable lease", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      runMaintenance({ isLeaseOwner: async () => false })
    ).resolves.toMatchObject({
      deadlineReached: false,
      leaseLost: true,
    });

    expect(query).not.toHaveBeenCalled();
  });

  it("aggregates and removes expired technical records without a privacy-request gate", async () => {
    dependencies.reconcileRevokedCertificateArtifacts.mockResolvedValue(7);
    dependencies.reconcileCertificateTemplateAssets.mockResolvedValue(9);
    dependencies.reconcileStagedAdminImageUploads.mockResolvedValue(8);
    dependencies.reconcileExpiredLessonResourceUploads.mockResolvedValue(10);
    dependencies.pruneEmailDeliveryRecords.mockResolvedValueOnce({
      events: 13,
      messages: 14,
    });
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 })
      .mockResolvedValueOnce({ rowCount: 10 })
      .mockResolvedValueOnce({ rowCount: 11 })
      .mockResolvedValueOnce({ rowCount: 5 })
      .mockResolvedValueOnce({ rowCount: 6 })
      .mockResolvedValueOnce({ rowCount: 12 })
      .mockResolvedValueOnce({ rowCount: 7 })
      .mockResolvedValueOnce({ rowCount: 1 });
    dependencies.getPool.mockReturnValue({ query });

    await expect(runMaintenance()).resolves.toEqual({
      certificateTemplateAssetsRemoved: 9,
      checkoutReservationsRemoved: 10,
      deadlineReached: false,
      expiredRateLimitsRemoved: 7,
      expiredSessionsRemoved: 2,
      emailDeliveryEventsRemoved: 13,
      emailDeliveryMessagesRemoved: 14,
      expiredLessonResourceUploadsRemoved: 10,
      learningAnalyticsAggregated: 5,
      learningAnalyticsEventsRemoved: 6,
      leaseLost: false,
      revokedCertificateArtifactsReconciled: 7,
      stagedAdminImagesRemoved: 8,
      supportRequestsRemoved: 12,
      webhookPayloadsSanitized: 11,
    });

    expect(query).toHaveBeenCalledWith(
      "delete from public_checkout_rate_limits where expires_at < now()"
    );
    const cleanupQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes("with stale_reservations")
    )?.[0];
    for (const predicate of [
      "created_at < now() - interval '15 minutes'",
      "provider = 'asaas'",
      "status = 'pending'",
      "checkout_status = 'pending'",
      "provider_checkout_id is null",
      "provider_payment_id is null",
      "provider_customer_id is null",
      "checkout_url is null",
      "checkout_attempt_count = 0",
      "checkout_last_attempt_at is null",
      "checkout_next_attempt_at is null",
      "checkout_error_message is null",
      "provider_checkout_status is null",
      "provider_payment_status is null",
      "provider_risk_status is null",
      "provider_settlement_status is null",
      "provider_refund_status is null",
      "provider_dispute_status is null",
      "paid_amount_in_cents is null",
      "payment_method is null",
      "receipt_url is null",
      "paid_at is null",
      "refunded_at is null",
    ]) {
      expect(cleanupQuery).toContain(predicate);
    }
    const webhookSanitizationQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes("with expired_payloads")
    )?.[0];
    expect(webhookSanitizationQuery).toContain("provider = 'asaas'");
    expect(webhookSanitizationQuery).toContain("payload_expires_at <= now()");
    expect(webhookSanitizationQuery).toContain("payload_sanitized_at is null");
    expect(webhookSanitizationQuery).toContain("payload = '{}'::jsonb");
    expect(webhookSanitizationQuery).toContain(
      "status in ('received', 'retryable', 'processing')"
    );
    expect(webhookSanitizationQuery).toContain(
      "then 'webhook_payload_expired'"
    );
    expect(webhookSanitizationQuery).toContain("then 'failed'::webhook_status");
    expect(webhookSanitizationQuery).toContain("next_attempt_at = case");
    expect(webhookSanitizationQuery).toContain("locked_at = case");
    expect(webhookSanitizationQuery).toContain("locked_by = case");
    expect(webhookSanitizationQuery).toContain("for update skip locked");
    expect(webhookSanitizationQuery).not.toContain(
      "delete from webhook_events"
    );
    expect(query).toHaveBeenCalledWith(
      "delete from learning_analytics_events where occurred_at < now() - interval '90 days'"
    );
    const analyticsAggregationQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes("insert into learning_analytics_daily_metrics")
    )?.[0];
    expect(analyticsAggregationQuery).toContain(
      "(occurred_at at time zone 'America/Sao_Paulo')::date"
    );
    expect(analyticsAggregationQuery).toContain(
      "date_trunc('day', current_timestamp at time zone 'America/Sao_Paulo')"
    );
    expect(analyticsAggregationQuery).not.toContain("occurred_at::date");
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("maintenance.executed"),
      [
        JSON.stringify({
          certificateTemplateAssetsRemoved: 9,
          checkoutReservationsRemoved: 10,
          deadlineReached: false,
          expiredRateLimitsRemoved: 7,
          expiredSessionsRemoved: 2,
          emailDeliveryEventsRemoved: 13,
          emailDeliveryMessagesRemoved: 14,
          expiredLessonResourceUploadsRemoved: 10,
          learningAnalyticsAggregated: 5,
          learningAnalyticsEventsRemoved: 6,
          leaseLost: false,
          revokedCertificateArtifactsReconciled: 7,
          stagedAdminImagesRemoved: 8,
          supportRequestsRemoved: 12,
          webhookPayloadsSanitized: 11,
        }),
      ]
    );
  });

  it("checks the durable lease before deleting checkout rate limits", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 });
    dependencies.getPool.mockReturnValue({ query });
    const isLeaseOwner = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(runMaintenance({ isLeaseOwner })).resolves.toMatchObject({
      expiredRateLimitsRemoved: 3,
      leaseLost: true,
    });
    expect(query).not.toHaveBeenCalledWith(
      "delete from public_checkout_rate_limits where expires_at < now()"
    );
  });

  it("checks the durable lease before deleting stale checkout reservations", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 });
    dependencies.getPool.mockReturnValue({ query });
    const isLeaseOwner = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(runMaintenance({ isLeaseOwner })).resolves.toMatchObject({
      checkoutReservationsRemoved: 0,
      expiredRateLimitsRemoved: 7,
      leaseLost: true,
    });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("with stale_reservations")
    );
  });

  it("checks the durable lease before sanitizing expired webhook payloads", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 })
      .mockResolvedValueOnce({ rowCount: 5 });
    dependencies.getPool.mockReturnValue({ query });
    const isLeaseOwner = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(runMaintenance({ isLeaseOwner })).resolves.toMatchObject({
      leaseLost: true,
      webhookPayloadsSanitized: 0,
    });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("with expired_payloads")
    );
  });
});
