import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  reconcileCertificateTemplateAssets: vi.fn(),
  reconcileRevokedCertificateArtifacts: vi.fn(),
  reconcileStagedAdminImageUploads: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
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
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 })
      .mockResolvedValueOnce({ rowCount: 5 })
      .mockResolvedValueOnce({ rowCount: 6 })
      .mockResolvedValueOnce({ rowCount: 1 });
    dependencies.getPool.mockReturnValue({ query });

    await expect(runMaintenance()).resolves.toEqual({
      certificateTemplateAssetsRemoved: 9,
      deadlineReached: false,
      expiredRateLimitsRemoved: 3,
      expiredSessionsRemoved: 2,
      learningAnalyticsAggregated: 4,
      learningAnalyticsEventsRemoved: 5,
      leaseLost: false,
      revokedCertificateArtifactsReconciled: 7,
      stagedAdminImagesRemoved: 8,
    });

    expect(query).toHaveBeenCalledWith(
      "delete from learning_analytics_events where occurred_at < now() - interval '90 days'"
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("maintenance.executed"),
      [
        JSON.stringify({
          certificateTemplateAssetsRemoved: 9,
          deadlineReached: false,
          expiredRateLimitsRemoved: 3,
          expiredSessionsRemoved: 2,
          learningAnalyticsAggregated: 4,
          learningAnalyticsEventsRemoved: 5,
          leaseLost: false,
          revokedCertificateArtifactsReconciled: 7,
          stagedAdminImagesRemoved: 8,
        }),
      ]
    );
  });
});
