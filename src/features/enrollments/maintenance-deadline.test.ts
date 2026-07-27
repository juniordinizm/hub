import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enqueueOutboxMessage: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import { processEnrollmentMaintenance } from "./maintenance";

describe("enrollment maintenance invocation boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not mutate grants after its invocation deadline", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      processEnrollmentMaintenance({
        clock: () => 500,
        deadlineAt: 500,
      })
    ).resolves.toMatchObject({
      deadlineReached: true,
      expiredCount: 0,
      leaseLost: false,
    });

    expect(query).not.toHaveBeenCalled();
  });

  it("does not mutate grants after losing its durable lease", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      processEnrollmentMaintenance({
        isLeaseOwner: async () => false,
      })
    ).resolves.toMatchObject({
      deadlineReached: false,
      expiredCount: 0,
      leaseLost: true,
    });

    expect(query).not.toHaveBeenCalled();
  });

  it("stops before expiring enrollment projections when the deadline is reached", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 2, rows: [] });
    const clock = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(500);
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      processEnrollmentMaintenance({
        clock,
        deadlineAt: 500,
      })
    ).resolves.toMatchObject({
      deadlineReached: true,
      expiredCount: 0,
    });

    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "update enrollment_grants"
    );
  });
});
