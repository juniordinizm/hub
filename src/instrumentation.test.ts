import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  getServerEnv: vi.fn(),
  getSentryOptions: vi.fn(),
  init: vi.fn(),
  logRequestFailure: vi.fn(),
  resolveSentryRelease: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: dependencies.captureRequestError,
  init: dependencies.init,
  withScope: (
    callback: (scope: { setTag: typeof dependencies.setTag }) => void
  ) => callback({ setTag: dependencies.setTag }),
}));
vi.mock("./lib/request-error", () => ({
  logRequestFailure: dependencies.logRequestFailure,
}));
vi.mock("./lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("./lib/sentry-deployment", () => ({
  resolveSentryRelease: dependencies.resolveSentryRelease,
}));
vi.mock("./lib/sentry-options", () => ({
  getSentryOptions: dependencies.getSentryOptions,
}));

import { onRequestError, register } from "./instrumentation";

describe("instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the environment and initializes Sentry in the Node startup context", async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    dependencies.resolveSentryRelease.mockReturnValue("a".repeat(40));
    dependencies.getSentryOptions.mockReturnValue({ enabled: true });

    try {
      await register();
    } finally {
      process.env.NEXT_RUNTIME = previousRuntime;
    }

    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      process.env.SENTRY_DSN,
      process.env.VERCEL_TARGET_ENV,
      "a".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("initializes Sentry with Edge-safe options in the Edge startup context", async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "edge";
    dependencies.resolveSentryRelease.mockReturnValue("b".repeat(40));
    dependencies.getSentryOptions.mockReturnValue({ enabled: true });

    try {
      await register();
    } finally {
      process.env.NEXT_RUNTIME = previousRuntime;
    }

    expect(dependencies.getServerEnv).not.toHaveBeenCalled();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      process.env.SENTRY_DSN,
      process.env.VERCEL_TARGET_ENV,
      "b".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("keeps the safe correlation ID in the Sentry event scope", () => {
    dependencies.logRequestFailure.mockReturnValue("correlation-123");
    const error = new Error("synthetic failure");
    const request = {
      headers: { "x-correlation-id": "correlation-123" },
      method: "GET",
      path: "/api/health/ready",
    };
    const context = {
      revalidateReason: undefined,
      routerKind: "App Router" as const,
      routePath: "/api/health/ready",
      routeType: "route" as const,
    };

    onRequestError(error, request, context);

    expect(dependencies.setTag).toHaveBeenCalledWith(
      "correlation_id",
      "correlation-123"
    );
    expect(dependencies.captureRequestError).toHaveBeenCalledWith(
      error,
      request,
      context
    );
  });
});
