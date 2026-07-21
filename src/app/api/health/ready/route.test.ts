import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
  getPool: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/operations/readiness", () => ({
  checkDatabaseReadiness: dependencies.checkDatabaseReadiness,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { GET } from "./route";

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    dependencies.getPool.mockReturnValue({ connect: vi.fn() });
    dependencies.getServerEnv.mockReturnValue({
      HEALTHCHECK_SECRET: "health-secret",
      NODE_ENV: "production",
    });
  });

  it("mantém liveness disponível quando o banco não está pronto", async () => {
    const { GET: liveness } = await import("../route");
    dependencies.checkDatabaseReadiness.mockResolvedValue({ ready: false });

    expect(liveness()).toMatchObject({ status: 200 });
  });

  it("não consulta o banco sem o bearer de readiness", async () => {
    const response = await GET(
      new Request("https://hub.example.test/api/health/ready")
    );

    expect(response.status).toBe(401);
    expect(dependencies.checkDatabaseReadiness).not.toHaveBeenCalled();
  });

  it("returns 503 without database access when production has no secret", async () => {
    dependencies.getServerEnv.mockReturnValue({
      HEALTHCHECK_SECRET: undefined,
      NODE_ENV: "production",
    });

    const response = await GET(
      new Request("https://hub.example.test/api/health/ready")
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(dependencies.checkDatabaseReadiness).not.toHaveBeenCalled();
  });

  it("responde 503 sem detalhes quando o banco falha", async () => {
    dependencies.checkDatabaseReadiness.mockResolvedValue({ ready: false });

    const response = await GET(
      new Request("https://hub.example.test/api/health/ready", {
        headers: { authorization: "Bearer health-secret" },
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it("responde pronto somente após a consulta do banco", async () => {
    dependencies.checkDatabaseReadiness.mockResolvedValue({ ready: true });

    const response = await GET(
      new Request("https://hub.example.test/api/health/ready", {
        headers: { authorization: "Bearer health-secret" },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "protea-r-hub",
    });
    expect(dependencies.checkDatabaseReadiness).toHaveBeenCalledWith({
      connect: expect.any(Function),
    });
  });
});
