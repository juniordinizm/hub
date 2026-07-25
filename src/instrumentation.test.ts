import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  getServerEnv: vi.fn(),
  logRequestFailure: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: dependencies.captureRequestError,
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
vi.mock("../sentry.server.config", () => ({}));

import { onRequestError, register } from "../instrumentation";

describe("onRequestError", () => {
  it("validates the production environment during Node startup", async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";

    try {
      await register();
    } finally {
      process.env.NEXT_RUNTIME = previousRuntime;
    }

    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
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
