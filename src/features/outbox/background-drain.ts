import { scheduleAfterResponse } from "@/features/operations/background-drain";
import { createCorrelationId } from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

const OUTBOX_BACKGROUND_DEADLINE_MS = 15_000;
const OUTBOX_BACKGROUND_LIMIT = 5;

type ScheduleAfterResponse = (callback: () => void | Promise<void>) => void;
type RunOutbox = (options: {
  deadlineMs: number;
  limit: number;
}) => Promise<unknown>;
type ObserveOperation = (options: {
  aggregateId?: string;
  correlationId: string;
  execute: () => Promise<unknown>;
  failureErrorCode: string;
  operation: string;
}) => Promise<unknown>;

const runDefaultOutbox = (options: {
  deadlineMs: number;
  limit: number;
}): Promise<unknown> =>
  import("./outbox-job").then(({ runOutboxJob }) => runOutboxJob(options));

export const scheduleOutboxDrainAfterResponse = ({
  aggregateId,
  correlationId = createCorrelationId(null),
  observe = observeOperation,
  run = runDefaultOutbox,
  schedule = scheduleAfterResponse,
}: {
  aggregateId?: string;
  correlationId?: string;
  observe?: ObserveOperation;
  run?: RunOutbox;
  schedule?: ScheduleAfterResponse;
} = {}): void => {
  schedule(() =>
    observe({
      ...(aggregateId ? { aggregateId } : {}),
      correlationId,
      execute: () =>
        run({
          deadlineMs: OUTBOX_BACKGROUND_DEADLINE_MS,
          limit: OUTBOX_BACKGROUND_LIMIT,
        }).then(() => undefined),
      failureErrorCode: "outbox_background_failed",
      operation: "outbox.background_drain",
    })
      .then(() => undefined)
      .catch(() => undefined)
  );
};
