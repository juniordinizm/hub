import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(() => "correlation-id"),
  getScheduledJobEarlyResponse: vi.fn(),
  observeOperation: vi.fn(),
  runOutboxJob: vi.fn(),
  withMonitor: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  withMonitor: dependencies.withMonitor,
}));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}));
vi.mock("@/features/operations/scheduled-job-request", () => ({
  getScheduledJobEarlyResponse: dependencies.getScheduledJobEarlyResponse,
}));
vi.mock("@/features/outbox/outbox-job", () => ({
  runOutboxJob: dependencies.runOutboxJob,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));

import { GET } from "./route";

const setEnvironmentValue = (key: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const withProductionEnvironment = async (
  callback: () => Promise<void>
): Promise<void> => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
  };
  setEnvironmentValue("NODE_ENV", "production");
  setEnvironmentValue("VERCEL_ENV", "production");
  setEnvironmentValue("VERCEL_TARGET_ENV", undefined);

  try {
    await callback();
  } finally {
    setEnvironmentValue("NODE_ENV", previous.NODE_ENV);
    setEnvironmentValue("VERCEL_ENV", previous.VERCEL_ENV);
    setEnvironmentValue("VERCEL_TARGET_ENV", previous.VERCEL_TARGET_ENV);
  }
};

const request = (): Request =>
  new Request("https://hub.example.test/api/cron/outbox", {
    headers: { "x-correlation-id": "incoming-correlation-id" },
  });

describe("GET /api/cron/outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.observeOperation.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );
    dependencies.withMonitor.mockImplementation(
      async (_monitorSlug: string, execute: () => Promise<unknown>) => execute()
    );
    dependencies.runOutboxJob.mockResolvedValue({
      deadLettered: 0,
      delivered: 1,
    });
  });

  it("monitors the Production outbox schedule with one low-volume cron monitor", async () => {
    await withProductionEnvironment(async () => {
      const response = await GET(request());

      await expect(response.json()).resolves.toEqual({
        ok: true,
        deadLettered: 0,
        delivered: 1,
      });
    });

    expect(dependencies.withMonitor).toHaveBeenCalledWith(
      "hub-outbox-production",
      expect.any(Function),
      {
        checkinMargin: 5,
        failureIssueThreshold: 2,
        isolateTrace: true,
        maxRuntime: 5,
        recoveryThreshold: 1,
        schedule: {
          type: "crontab",
          value: "*/15 * * * *",
        },
        timezone: "UTC",
      }
    );
  });

  it("does not create cron check-ins outside Production", async () => {
    const response = await GET(request());

    await expect(response.json()).resolves.toEqual({
      ok: true,
      deadLettered: 0,
      delivered: 1,
    });
    expect(dependencies.withMonitor).not.toHaveBeenCalled();
  });
});
