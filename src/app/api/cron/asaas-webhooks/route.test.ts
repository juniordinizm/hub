import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(() => "correlation-id"),
  getServerEnv: vi.fn(),
  getScheduledJobEarlyResponse: vi.fn(),
  observeOperation: vi.fn(
    async ({ execute }: { execute: () => Promise<unknown> }) => await execute()
  ),
  runAsaasWebhookJob: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}));
vi.mock("@/features/operations/scheduled-job-request", () => ({
  getScheduledJobEarlyResponse: dependencies.getScheduledJobEarlyResponse,
}));
vi.mock("@/features/payments/asaas-webhook-job", () => ({
  runAsaasWebhookJob: dependencies.runAsaasWebhookJob,
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
    expect(dependencies.runAsaasWebhookJob).not.toHaveBeenCalled();
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
    expect(dependencies.runAsaasWebhookJob).not.toHaveBeenCalled();
  });

  it("runs the real processor under the configured lease and deadline", async () => {
    const workerResult = {
      deadlineReached: false,
      failed: 0,
      ignored: 1,
      leaseLost: false,
      processed: 2,
      retried: 0,
    };
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runAsaasWebhookJob.mockResolvedValue(workerResult);

    const response = await GET(createRequest());

    expect(dependencies.runAsaasWebhookJob).toHaveBeenCalledWith();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ...workerResult,
    });
  });

  it("returns a safe successful skip when another invocation owns the lease", async () => {
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runAsaasWebhookJob.mockResolvedValue({
      reason: "already_running",
      skipped: true,
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.runAsaasWebhookJob).toHaveBeenCalledOnce();
  });

  it("propagates worker failures through sanitized Asaas observability", async () => {
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.runAsaasWebhookJob.mockRejectedValue(
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
