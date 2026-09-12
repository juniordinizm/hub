import { captureRequestError, init, withScope } from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { getServerEnv } from "./lib/env";
import { logRequestFailure } from "./lib/request-error";
import { resolveRuntimeEnvironment } from "./lib/runtime-environment";
import { resolveSentryRelease } from "./lib/sentry-deployment";
import { getSentryOptions } from "./lib/sentry-options";

export const register = (): void => {
  const runtimeEnvironment = resolveRuntimeEnvironment(process.env);

  if (process.env.NEXT_RUNTIME === "nodejs") {
    getServerEnv();
  }

  if (runtimeEnvironment !== "production") {
    return;
  }

  init(
    getSentryOptions(
      process.env.SENTRY_DSN,
      runtimeEnvironment,
      resolveSentryRelease(process.env)
    )
  );
};

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const correlationId = logRequestFailure({ context, request });
  if (resolveRuntimeEnvironment(process.env) !== "production") {
    return;
  }

  withScope((scope) => {
    scope.setTag("correlation_id", correlationId);
    captureRequestError(error, request, context);
  });
};
