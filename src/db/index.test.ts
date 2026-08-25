import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  class FakePool {
    on = vi.fn();

    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }

  return {
    FakePool,
    createCorrelationId: vi.fn(() => "0198d6f4-c2a5-7000-8000-000000000001"),
    getServerEnv: vi.fn(),
    logOperationalEvent: vi.fn(),
    withVerifiedSslMode: vi.fn((value: string) => value),
    getDatabasePoolOptions: vi.fn(() => ({
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 3,
    })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({ Pool: dependencies.FakePool }));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));
vi.mock("@/db/connection-url", () => ({
  withVerifiedSslMode: dependencies.withVerifiedSslMode,
}));
vi.mock("@/db/pool-policy", () => ({
  getDatabasePoolOptions: dependencies.getDatabasePoolOptions,
}));

import { getPool, getReadinessPool } from "./index";

describe("database pool error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      DATABASE_URL: "postgresql://staging.example.test/hub",
    });
  });

  it("registers a non-throwing client error handler on application pools", () => {
    const pool = getPool() as unknown as InstanceType<
      typeof dependencies.FakePool
    >;
    const errorHandler = pool.on.mock.calls.find(
      ([event]) => event === "error"
    )?.[1] as ((error: Error) => void) | undefined;

    expect(errorHandler).toEqual(expect.any(Function));
    errorHandler?.(new Error("Connection terminated unexpectedly"));

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "database_pool_client_error",
        operation: "database.pool",
        outcome: "failure",
        provider: "database",
      })
    );
  });

  it("registers the same guard on the readiness pool", () => {
    const pool = getReadinessPool() as unknown as InstanceType<
      typeof dependencies.FakePool
    >;
    expect(pool.on).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
