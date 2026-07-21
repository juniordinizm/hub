import { logOperationalEvent, type OperationalEvent } from "./observability";

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
    const result = await execute();
    logOperationalEvent(
      {
        ...eventBase,
        durationMs: now() - startedAt,
        outcome: "success",
      },
      write
    );
    return result;
  } catch (error) {
    logOperationalEvent(
      {
        ...eventBase,
        durationMs: now() - startedAt,
        errorCode: failureErrorCode,
        outcome: "failure",
      },
      write
    );
    throw error;
  }
};
