import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  runOutboxWorker: vi.fn(),
  runWithScheduledJobLease: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/operations/scheduled-job-lease", () => ({
  runWithScheduledJobLease: dependencies.runWithScheduledJobLease,
}));
vi.mock("@/features/outbox/runner", () => ({
  runOutboxWorker: dependencies.runOutboxWorker,
}));

import { runOutboxJob } from "./outbox-job";

describe("runOutboxJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the aggregate worker under the shared lease with an explicit limit", async () => {
    const isLeaseOwner = vi.fn(async () => true);
    const result = {
      deadLettered: 0,
      deadlineReached: false,
      deferred: 0,
      delivered: 1,
      leaseLost: false,
      prunedDeadLetters: 0,
      prunedDelivered: 0,
      prunedReprocessAudits: 0,
      prunedSuperseded: 0,
      retried: 0,
      superseded: 0,
    };
    dependencies.runOutboxWorker.mockResolvedValue(result);
    dependencies.runWithScheduledJobLease.mockImplementation(
      async ({
        execute,
      }: {
        execute: (context: unknown) => Promise<unknown>;
      }) => ({
        acquired: true,
        value: await execute({ deadlineAt: 123, isLeaseOwner }),
      })
    );

    await expect(
      runOutboxJob({ deadlineMs: 45_000, limit: 1 })
    ).resolves.toEqual(result);
    expect(dependencies.runWithScheduledJobLease).toHaveBeenCalledWith({
      deadlineMs: 45_000,
      execute: expect.any(Function),
      jobName: "outbox",
      leaseMs: 360_000,
    });
    expect(dependencies.runOutboxWorker).toHaveBeenCalledWith({
      deadlineAt: 123,
      limit: 1,
      shouldContinue: isLeaseOwner,
    });
  });

  it("returns a lease skip without running the worker", async () => {
    dependencies.runWithScheduledJobLease.mockResolvedValue({
      acquired: false,
    });

    await expect(runOutboxJob({ limit: 1 })).resolves.toEqual({
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.runOutboxWorker).not.toHaveBeenCalled();
  });
});
