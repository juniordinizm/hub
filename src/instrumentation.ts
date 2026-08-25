import { captureRequestError, init, withScope } from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { getServerEnv } from "./lib/env";
import { logRequestFailure } from "./lib/request-error";
import { resolveSentryRelease } from "./lib/sentry-deployment";
import { getSentryOptions } from "./lib/sentry-options";

export const register = (): void => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    getServerEnv();
    init(
      getSentryOptions(
        process.env.SENTRY_DSN,
        process.env.VERCEL_TARGET_ENV,
        resolveSentryRelease(process.env)
      )
    );
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    init(
      getSentryOptions(
        process.env.SENTRY_DSN,
        process.env.VERCEL_TARGET_ENV,
        resolveSentryRelease(process.env)
      )
    );
  }
};

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const correlationId = logRequestFailure({ context, request });
  withScope((scope) => {
    scope.setTag("correlation_id", correlationId);
    captureRequestError(error, request, context);
  });
};
