import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  processAsaasWebhookEvent: vi.fn(),
  runAsaasWebhookWorker: vi.fn(),
  runWithScheduledJobLease: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/operations/scheduled-job-lease", () => ({
  runWithScheduledJobLease: dependencies.runWithScheduledJobLease,
}));
vi.mock("@/features/payments/asaas-webhook-processor", () => ({
  processAsaasWebhookEvent: dependencies.processAsaasWebhookEvent,
}));
vi.mock("@/features/payments/asaas-webhook-worker", () => ({
  runAsaasWebhookWorker: dependencies.runAsaasWebhookWorker,
}));

import { runAsaasWebhookJob } from "./asaas-webhook-job";

describe("runAsaasWebhookJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the worker under the shared lease with an explicit bounded limit", async () => {
    const isLeaseOwner = vi.fn(async () => true);
    const result = {
      deadlineReached: false,
      failed: 0,
      ignored: 0,
      leaseLost: false,
      processed: 1,
      retried: 0,
    };
    dependencies.runAsaasWebhookWorker.mockResolvedValue(result);
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
      runAsaasWebhookJob({ deadlineMs: 45_000, limit: 1 })
    ).resolves.toEqual(result);
    expect(dependencies.runWithScheduledJobLease).toHaveBeenCalledWith({
      deadlineMs: 45_000,
      execute: expect.any(Function),
      jobName: "asaas-webhooks",
      leaseMs: 360_000,
    });
    expect(dependencies.runAsaasWebhookWorker).toHaveBeenCalledWith({
      deadlineAt: 123,
      limit: 1,
      processor: dependencies.processAsaasWebhookEvent,
      shouldContinue: isLeaseOwner,
    });
  });

  it("returns a lease skip without running the worker", async () => {
    dependencies.runWithScheduledJobLease.mockResolvedValue({
      acquired: false,
    });

    await expect(runAsaasWebhookJob({ limit: 1 })).resolves.toEqual({
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.runAsaasWebhookWorker).not.toHaveBeenCalled();
  });
});
