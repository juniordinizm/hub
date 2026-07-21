import { captureRequestError, withScope } from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { logRequestFailure } from "./src/lib/request-error";

export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
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
