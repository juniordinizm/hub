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

describe("instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the environment and initializes Sentry in the Node startup context", async () => {
    await withProductionEnvironment(async () => {
      const previousRuntime = process.env.NEXT_RUNTIME;
      process.env.NEXT_RUNTIME = "nodejs";
      dependencies.resolveSentryRelease.mockReturnValue("a".repeat(40));
      dependencies.getSentryOptions.mockReturnValue({ enabled: true });

      try {
        await register();
      } finally {
        setEnvironmentValue("NEXT_RUNTIME", previousRuntime);
      }
    });

    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      process.env.SENTRY_DSN,
      "production",
      "a".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("initializes Sentry with Edge-safe options in the Edge startup context", async () => {
    await withProductionEnvironment(async () => {
      const previousRuntime = process.env.NEXT_RUNTIME;
      process.env.NEXT_RUNTIME = "edge";
      dependencies.resolveSentryRelease.mockReturnValue("b".repeat(40));
      dependencies.getSentryOptions.mockReturnValue({ enabled: true });

      try {
        await register();
      } finally {
        setEnvironmentValue("NEXT_RUNTIME", previousRuntime);
      }
    });

    expect(dependencies.getServerEnv).not.toHaveBeenCalled();
    expect(dependencies.getSentryOptions).toHaveBeenCalledWith(
      process.env.SENTRY_DSN,
      "production",
      "b".repeat(40)
    );
    expect(dependencies.init).toHaveBeenCalledWith({ enabled: true });
  });

  it("does not initialize Sentry outside Production", async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    const previousNodeEnvironment = process.env.NODE_ENV;
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    const previousVercelTargetEnvironment = process.env.VERCEL_TARGET_ENV;
    setEnvironmentValue("NEXT_RUNTIME", "edge");
    setEnvironmentValue("NODE_ENV", "test");
    setEnvironmentValue("VERCEL_ENV", "preview");
    setEnvironmentValue("VERCEL_TARGET_ENV", "staging");

    try {
      await register();
    } finally {
      setEnvironmentValue("NEXT_RUNTIME", previousRuntime);
      setEnvironmentValue("NODE_ENV", previousNodeEnvironment);
      setEnvironmentValue("VERCEL_ENV", previousVercelEnvironment);
      setEnvironmentValue("VERCEL_TARGET_ENV", previousVercelTargetEnvironment);
    }

    expect(dependencies.getSentryOptions).not.toHaveBeenCalled();
    expect(dependencies.init).not.toHaveBeenCalled();
  });

  it("keeps the safe correlation ID in the Sentry event scope", () => {
    const previousNodeEnvironment = process.env.NODE_ENV;
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    setEnvironmentValue("NODE_ENV", "production");
    setEnvironmentValue("VERCEL_ENV", "production");
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

    try {
      onRequestError(error, request, context);
    } finally {
      setEnvironmentValue("NODE_ENV", previousNodeEnvironment);
      setEnvironmentValue("VERCEL_ENV", previousVercelEnvironment);
    }

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

  it("does not capture request errors outside Production", () => {
    const previousNodeEnvironment = process.env.NODE_ENV;
    const previousVercelEnvironment = process.env.VERCEL_ENV;
    setEnvironmentValue("NODE_ENV", "test");
    setEnvironmentValue("VERCEL_ENV", "preview");

    try {
      onRequestError(
        new Error("non-production failure"),
        { headers: {}, method: "GET", path: "/health" },
        {
          revalidateReason: undefined,
          routerKind: "App Router",
          routePath: "/health",
          routeType: "route",
        }
      );
    } finally {
      setEnvironmentValue("NODE_ENV", previousNodeEnvironment);
      setEnvironmentValue("VERCEL_ENV", previousVercelEnvironment);
    }

    expect(dependencies.captureRequestError).not.toHaveBeenCalled();
  });
});
