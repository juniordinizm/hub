import { logOperationalEvent, type OperationalEvent } from "./observability";
import { observeSentryOperation } from "./sentry-operation";

export const observeOperation = async <Result>({
  aggregateId,
  correlationId,
  execute,
  failureErrorCode = "operation_failed",
  now = Date.now,
  operation,
  provider,
  startedAt = now(),
  write,
}: {
  aggregateId?: string;
  correlationId: string;
  execute: () => Promise<Result>;
  failureErrorCode?: string;
  now?: () => number;
  operation: string;
  provider?: OperationalEvent["provider"];
  startedAt?: number;
  write?: (record: string) => void;
}): Promise<Result> => {
  const eventBase = {
    ...(aggregateId ? { aggregateId } : {}),
    correlationId,
    operation,
    ...(provider ? { provider } : {}),
  };

  try {
    const result = await observeSentryOperation({
      execute,
      now,
      operation,
      ...(provider ? { provider } : {}),
      startedAt,
    });
    const durationMs = Math.max(0, now() - startedAt);
    logOperationalEvent(
      {
        ...eventBase,
        durationMs,
        outcome: "success",
      },
      write
    );
    return result;
  } catch (error) {
    const durationMs = Math.max(0, now() - startedAt);
    logOperationalEvent(
      {
        ...eventBase,
        durationMs,
        errorCode: failureErrorCode,
        outcome: "failure",
      },
      write
    );
    throw error;
  }
};
