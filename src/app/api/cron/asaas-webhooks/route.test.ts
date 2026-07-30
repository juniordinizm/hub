import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(() => "correlation-id"),
  getServerEnv: vi.fn(),
  getScheduledJobEarlyResponse: vi.fn(),
  observeOperation: vi.fn(
    async ({ execute }: { execute: () => Promise<unknown> }) => await execute()
  ),
  processAsaasWebhookEvent: vi.fn(),
  runAsaasWebhookWorker: vi.fn(),
  runWithScheduledJobLease: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}));
vi.mock("@/features/operations/scheduled-job-lease", () => ({
  runWithScheduledJobLease: dependencies.runWithScheduledJobLease,
}));
vi.mock("@/features/operations/scheduled-job-request", () => ({
  getScheduledJobEarlyResponse: dependencies.getScheduledJobEarlyResponse,
}));
vi.mock("@/features/payments/asaas-webhook-processor", () => ({
  processAsaasWebhookEvent: dependencies.processAsaasWebhookEvent,
}));
vi.mock("@/features/payments/asaas-webhook-worker", () => ({
  runAsaasWebhookWorker: dependencies.runAsaasWebhookWorker,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));

import { dynamic, GET, maxDuration, runtime } from "./route";

const createRequest = (): Request =>
  new Request("https://hub.example.com/api/cron/asaas-webhooks", {
    headers: { "x-correlation-id": "incoming-correlation-id" },
  });

describe("Asaas webhook cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_WEBHOOK_ENABLED: true,
    });
    dependencies.observeOperation.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) =>
        await execute()
    );
  });

  it("skips before acquiring a lease when the Asaas webhook is disabled", async () => {
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.getServerEnv.mockReturnValue({
      ASAAS_WEBHOOK_ENABLED: false,
    });

    const response = await GET(createRequest());

    await expect(response.json()).resolves.toEqual({
      ok: true,
      reason: "asaas_webhook_disabled",
      skipped: true,
    });
    expect(dependencies.runWithScheduledJobLease).not.toHaveBeenCalled();
    expect(dependencies.runAsaasWebhookWorker).not.toHaveBeenCalled();
  });

  it("uses the shared request guard before acquiring the database lease", async () => {
    const earlyResponse = Response.json(
      { reason: "scheduled_jobs_disabled", skipped: true },
      { status: 200 }
    );
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(earlyResponse);

    const response = await GET(createRequest());

    expect(response).toBe(earlyResponse);
    expect(dependencies.getScheduledJobEarlyResponse).toHaveBeenCalledOnce();
    expect(dependencies.runWithScheduledJobLease).not.toHaveBeenCalled();
  });

  it("runs the real processor under the configured lease and deadline", async () => {
    const isLeaseOwner = vi.fn(async () => true);
    const workerResult = {
      deadlineReached: false,
      failed: 0,
      ignored: 1,
      leaseLost: false,
      processed: 2,
      retried: 0,
    };
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runAsaasWebhookWorker.mockResolvedValue(workerResult);
    dependencies.runWithScheduledJobLease.mockImplementation(
      async ({
        execute,
      }: {
        execute: (context: {
          deadlineAt: number;
          isLeaseOwner: () => Promise<boolean>;
        }) => Promise<unknown>;
      }) => ({
        acquired: true,
        value: await execute({ deadlineAt: 123_456, isLeaseOwner }),
      })
    );

    const response = await GET(createRequest());

    expect(dependencies.runWithScheduledJobLease).toHaveBeenCalledWith({
      deadlineMs: 270_000,
      execute: expect.any(Function),
      jobName: "asaas-webhooks",
      leaseMs: 360_000,
    });
    expect(dependencies.runAsaasWebhookWorker).toHaveBeenCalledWith({
      deadlineAt: 123_456,
      processor: dependencies.processAsaasWebhookEvent,
      shouldContinue: isLeaseOwner,
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ...workerResult,
    });
  });

  it("returns a safe successful skip when another invocation owns the lease", async () => {
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runWithScheduledJobLease.mockResolvedValue({
      acquired: false,
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.runAsaasWebhookWorker).not.toHaveBeenCalled();
  });

  it("propagates worker failures through sanitized Asaas observability", async () => {
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runWithScheduledJobLease.mockRejectedValue(
      new Error("payload contains private data")
    );

    await expect(GET(createRequest())).rejects.toThrow(
      "payload contains private data"
    );
    expect(dependencies.observeOperation).toHaveBeenCalledWith({
      correlationId: "correlation-id",
      execute: expect.any(Function),
      failureErrorCode: "asaas_webhook_worker_failed",
      operation: "cron.asaas-webhooks",
      provider: "asaas",
    });
  });

  it("uses the Node.js runtime budget required by the worker", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(300);
  });
});
