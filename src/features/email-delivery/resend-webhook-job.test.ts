import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  runResendWebhookWorker: vi.fn(),
  runWithScheduledJobLease: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/operations/scheduled-job-lease", () => ({
  runWithScheduledJobLease: dependencies.runWithScheduledJobLease,
}));
vi.mock("@/features/email-delivery/runner", () => ({
  runResendWebhookWorker: dependencies.runResendWebhookWorker,
}));

import { runResendWebhookJob } from "./resend-webhook-job";

describe("runResendWebhookJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the worker under the shared lease with an explicit bounded limit", async () => {
    const isLeaseOwner = vi.fn(async () => true);
    const result = {
      deadLettered: 0,
      deadlineReached: false,
      ignored: 0,
      leaseLost: false,
      processed: 1,
      prunedEvents: 0,
      prunedMessages: 0,
      retried: 0,
    };
    dependencies.runResendWebhookWorker.mockResolvedValue(result);
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
      runResendWebhookJob({ deadlineMs: 45_000, limit: 1 })
    ).resolves.toEqual(result);
    expect(dependencies.runWithScheduledJobLease).toHaveBeenCalledWith({
      deadlineMs: 45_000,
      execute: expect.any(Function),
      jobName: "resend-webhooks",
      leaseMs: 360_000,
    });
    expect(dependencies.runResendWebhookWorker).toHaveBeenCalledWith({
      deadlineAt: 123,
      limit: 1,
      shouldContinue: isLeaseOwner,
    });
  });

  it("returns a lease skip without running the worker", async () => {
    dependencies.runWithScheduledJobLease.mockResolvedValue({
      acquired: false,
    });

    await expect(runResendWebhookJob({ limit: 1 })).resolves.toEqual({
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.runResendWebhookWorker).not.toHaveBeenCalled();
  });
});
