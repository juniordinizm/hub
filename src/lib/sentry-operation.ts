import { SPAN_KIND } from "@sentry/core";
import { metrics, startSpan } from "@sentry/nextjs";
import type { OperationalEvent } from "./observability";
import { resolveRuntimeEnvironment } from "./runtime-environment";

const SENTRY_OPERATION_COUNT_METRIC = "hub.operation.count";
const SENTRY_OPERATION_DURATION_METRIC = "hub.operation.duration";
const SENTRY_OPERATION_SPAN = "hub.operation";

const isProductionRuntime = (): boolean =>
  resolveRuntimeEnvironment(process.env) === "production";

const recordSentryOperationMetrics = ({
  durationMs,
  operation,
  outcome,
  provider,
}: {
  durationMs: number;
  operation: string;
  outcome: OperationalEvent["outcome"];
  provider?: OperationalEvent["provider"];
}): void => {
  if (!isProductionRuntime()) {
    return;
  }

  const attributes = {
    operation,
    outcome,
    ...(provider ? { provider } : {}),
  };

  try {
    metrics.count(SENTRY_OPERATION_COUNT_METRIC, 1, { attributes });
    metrics.distribution(SENTRY_OPERATION_DURATION_METRIC, durationMs, {
      attributes,
      unit: "millisecond",
    });
  } catch {
    // Observability must never change the business operation outcome.
  }
};

const withProductionSentrySpan = <Result>({
  execute,
  operation,
  provider,
}: {
  execute: () => Promise<Result>;
  operation: string;
  provider?: OperationalEvent["provider"];
}): Promise<Result> => {
  if (!isProductionRuntime()) {
    return execute();
  }

  return startSpan(
    {
      attributes: {
        "hub.operation": operation,
        ...(provider ? { "hub.provider": provider } : {}),
      },
      kind: SPAN_KIND.INTERNAL,
      name: operation,
      onlyIfParent: true,
      op: SENTRY_OPERATION_SPAN,
    },
    async (span) => {
      try {
        const result = await execute();
        span.setAttribute("hub.outcome", "success");
        span.setStatus({ code: 1 });
        return result;
      } catch (error) {
        span.setAttribute("hub.outcome", "failure");
        span.setStatus({ code: 2 });
        throw error;
      }
    }
  );
};

export const observeSentryOperation = async <Result>({
  execute,
  now = Date.now,
  operation,
  provider,
  startedAt = now(),
}: {
  execute: () => Promise<Result>;
  now?: () => number;
  operation: string;
  provider?: OperationalEvent["provider"];
  startedAt?: number;
}): Promise<Result> => {
  try {
    const result = await withProductionSentrySpan({
      execute,
      operation,
      ...(provider ? { provider } : {}),
    });
    recordSentryOperationMetrics({
      durationMs: Math.max(0, now() - startedAt),
      operation,
      outcome: "success",
      ...(provider ? { provider } : {}),
    });
    return result;
  } catch (error) {
    recordSentryOperationMetrics({
      durationMs: Math.max(0, now() - startedAt),
      operation,
      outcome: "failure",
      ...(provider ? { provider } : {}),
    });
    throw error;
  }
};
