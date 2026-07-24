import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  reconcileRevokedCertificateArtifacts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/certificates/artifact-reconciliation", () => ({
  reconcileRevokedCertificateArtifacts:
    dependencies.reconcileRevokedCertificateArtifacts,
}));

import { runMaintenance } from "./server";

describe("runMaintenance", () => {
  it("aggregates and removes expired technical records without a privacy-request gate", async () => {
    dependencies.reconcileRevokedCertificateArtifacts.mockResolvedValue(7);
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
      expiredRateLimitsRemoved: 3,
      expiredSessionsRemoved: 2,
      learningAnalyticsAggregated: 4,
      learningAnalyticsEventsRemoved: 5,
      revokedCertificateArtifactsReconciled: 7,
    });

    expect(query).toHaveBeenCalledWith(
      "delete from learning_analytics_events where occurred_at < now() - interval '90 days'"
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("maintenance.executed"),
      [
        JSON.stringify({
          expiredRateLimitsRemoved: 3,
          expiredSessionsRemoved: 2,
          learningAnalyticsAggregated: 4,
          learningAnalyticsEventsRemoved: 5,
          revokedCertificateArtifactsReconciled: 7,
        }),
      ]
    );
  });
});
