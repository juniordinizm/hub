import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  checkR2ObjectStorage: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  checkR2ObjectStorage: dependencies.checkR2ObjectStorage,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: () => "00000000-0000-4000-8000-000000000001",
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { GET } from "./route";

const secret = "healthcheck-secret-at-least-thirty-two-characters";

const request = (authorization?: string): Request => {
  const init: RequestInit = authorization ? { headers: { authorization } } : {};
  return new Request("https://hub.example.test/api/health/r2", init);
};

describe("GET /api/health/r2", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      HEALTHCHECK_SECRET: secret,
      NODE_ENV: "production",
    });
    dependencies.checkR2ObjectStorage.mockResolvedValue(undefined);
  });

  it("rejects requests without the readiness bearer", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(dependencies.checkR2ObjectStorage).not.toHaveBeenCalled();
  });

  it("reports unavailable when the readiness secret is missing", async () => {
    dependencies.getServerEnv.mockReturnValue({
      HEALTHCHECK_SECRET: undefined,
      NODE_ENV: "production",
    });

    const response = await GET(request(`Bearer ${secret}`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(dependencies.checkR2ObjectStorage).not.toHaveBeenCalled();
  });

  it("returns unavailable without exposing the provider error", async () => {
    dependencies.checkR2ObjectStorage.mockRejectedValue(
      new Error("provider credential detail")
    );

    const response = await GET(request(`Bearer ${secret}`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      correlationId: "00000000-0000-4000-8000-000000000001",
      durationMs: expect.any(Number),
      errorCode: "r2_unavailable",
      httpStatus: 503,
      operation: "health.r2",
      outcome: "failure",
      provider: "r2",
    });
  });

  it("returns ready after a successful write and read probe", async () => {
    const response = await GET(request(`Bearer ${secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      provider: "r2",
    });
    expect(dependencies.checkR2ObjectStorage).toHaveBeenCalledOnce();
  });
});
