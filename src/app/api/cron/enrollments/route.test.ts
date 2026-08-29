import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(() => "correlation-id"),
  getScheduledJobEarlyResponse: vi.fn(),
  observeOperation: vi.fn(),
  processEnrollmentMaintenance: vi.fn(),
  runWithScheduledJobLease: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}));
vi.mock("@/features/enrollments/maintenance", () => ({
  processEnrollmentMaintenance: dependencies.processEnrollmentMaintenance,
}));
vi.mock("@/features/operations/scheduled-job-lease", () => ({
  runWithScheduledJobLease: dependencies.runWithScheduledJobLease,
}));
vi.mock("@/features/operations/scheduled-job-request", () => ({
  getScheduledJobEarlyResponse: dependencies.getScheduledJobEarlyResponse,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));

import { dynamic, GET, maxDuration, runtime } from "./route";

const request = (): Request =>
  new Request("https://hub.example.test/api/cron/enrollments", {
    headers: { "x-correlation-id": "incoming-correlation-id" },
  });

describe("GET /api/cron/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(null);
    dependencies.observeOperation.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );
  });

  it("returns the authorization response before acquiring a lease", async () => {
    const earlyResponse = Response.json(
      { error: "Nao autorizado." },
      { status: 401 }
    );
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(earlyResponse);

    const response = await GET(request());

    expect(response).toBe(earlyResponse);
    expect(dependencies.getScheduledJobEarlyResponse).toHaveBeenCalledOnce();
    expect(dependencies.runWithScheduledJobLease).not.toHaveBeenCalled();
    expect(dependencies.processEnrollmentMaintenance).not.toHaveBeenCalled();
  });

  it("returns the disabled-job response before acquiring a lease", async () => {
    const earlyResponse = Response.json({
      ok: true,
      reason: "scheduled_jobs_disabled",
      skipped: true,
    });
    dependencies.getScheduledJobEarlyResponse.mockReturnValue(earlyResponse);

    const response = await GET(request());

    expect(response).toBe(earlyResponse);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reason: "scheduled_jobs_disabled",
      skipped: true,
    });
    expect(dependencies.runWithScheduledJobLease).not.toHaveBeenCalled();
  });

  it("runs maintenance under the configured lease and deadline", async () => {
    const isLeaseOwner = vi.fn(async () => true);
    const maintenanceResult = {
      deadlineReached: false,
      expired: 2,
      leaseLost: false,
      warnings: 1,
    };
    dependencies.processEnrollmentMaintenance.mockResolvedValue(
      maintenanceResult
    );
    dependencies.runWithScheduledJobLease.mockImplementation(
      async ({
        execute,
      }: {
        execute: (context: unknown) => Promise<unknown>;
      }) => ({
        acquired: true,
        value: await execute({
          deadlineAt: 123_456,
          isLeaseOwner,
          ownerToken: "owner-token",
        }),
      })
    );

    const response = await GET(request());

    expect(dependencies.runWithScheduledJobLease).toHaveBeenCalledWith({
      deadlineMs: 720_000,
      execute: expect.any(Function),
      jobName: "enrollments",
      leaseMs: 900_000,
    });
    expect(dependencies.processEnrollmentMaintenance).toHaveBeenCalledWith({
      deadlineAt: 123_456,
      isLeaseOwner,
      ownerToken: "owner-token",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ...maintenanceResult,
    });
  });

  it("returns a safe skip when another invocation owns the lease", async () => {
    dependencies.runWithScheduledJobLease.mockResolvedValue({
      acquired: false,
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reason: "already_running",
      skipped: true,
    });
    expect(dependencies.processEnrollmentMaintenance).not.toHaveBeenCalled();
  });

  it("records a sanitized operational failure contract", async () => {
    const failure = new Error("database password and private student data");
    dependencies.runWithScheduledJobLease.mockRejectedValue(failure);

    await expect(GET(request())).rejects.toBe(failure);
    expect(dependencies.observeOperation).toHaveBeenCalledWith({
      correlationId: "correlation-id",
      execute: expect.any(Function),
      failureErrorCode: "enrollment_maintenance_failed",
      operation: "cron.enrollments",
      provider: "database",
    });
  });

  it("uses the Node.js runtime budget required by maintenance", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(800);
  });
});
