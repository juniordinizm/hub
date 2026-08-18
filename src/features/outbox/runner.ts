import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { deliverOutboxMessage } from "./delivery";
import {
  claimOutboxMessages,
  markOutboxMessageDeadLetter,
  markOutboxMessageDeferred,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  pruneOutboxRecords,
} from "./server";
import { processClaimedOutboxMessage } from "./worker";

const DEFAULT_BATCH_LIMIT = 20;

export interface OutboxWorkerResult {
  deadLettered: number;
  deadlineReached: boolean;
  deferred: number;
  delivered: number;
  leaseLost: boolean;
  prunedDeadLetters: number;
  prunedDelivered: number;
  prunedReprocessAudits: number;
  retried: number;
}

export const runOutboxWorker = async ({
  deadlineAt = Number.POSITIVE_INFINITY,
  limit = DEFAULT_BATCH_LIMIT,
  now = Date.now,
  shouldContinue = async () => true,
  workerId = `outbox-${randomUUID()}`,
}: {
  deadlineAt?: number;
  limit?: number;
  now?: () => number;
  shouldContinue?: () => Promise<boolean>;
  workerId?: string;
} = {}): Promise<OutboxWorkerResult> => {
  const client = getPool();
  const result: OutboxWorkerResult = {
    deadLettered: 0,
    deadlineReached: false,
    deferred: 0,
    delivered: 0,
    leaseLost: false,
    prunedDeadLetters: 0,
    prunedDelivered: 0,
    prunedReprocessAudits: 0,
    retried: 0,
  };

  let processed = 0;
  while (processed < limit) {
    if (now() >= deadlineAt) {
      result.deadlineReached = true;
      break;
    }
    if (!(await shouldContinue())) {
      result.leaseLost = true;
      break;
    }
    const messages = await claimOutboxMessages({
      client,
      limit: 1,
      workerId,
    });
    const message = messages[0];
    if (!message) {
      break;
    }
    processed += 1;

    const outcome = await processClaimedOutboxMessage({
      deliver: deliverOutboxMessage,
      markDeadLetter: ({ errorCode, id }) =>
        markOutboxMessageDeadLetter({
          client,
          errorCode,
          id,
          workerId,
        }),
      markDeferred: ({ errorCode, id }) =>
        markOutboxMessageDeferred({
          client,
          errorCode,
          id,
          workerId,
        }),
      markDelivered: (id) =>
        markOutboxMessageDelivered({ client, id, workerId }),
      markRetry: ({ errorCode, id, retryDelayMs }) =>
        markOutboxMessageForRetry({
          client,
          errorCode,
          id,
          retryDelayMs,
          workerId,
        }),
      message,
    });
    if (outcome === "lease_lost") {
      result.leaseLost = true;
      break;
    }
    if (outcome === "delivered") {
      result.delivered += 1;
    } else if (outcome === "deferred") {
      result.deferred += 1;
    } else if (outcome === "retrying") {
      result.retried += 1;
    } else {
      result.deadLettered += 1;
    }
  }

  if (result.deadlineReached || result.leaseLost) {
    return result;
  }

  if (now() >= deadlineAt) {
    result.deadlineReached = true;
    return result;
  }
  if (!(await shouldContinue())) {
    result.leaseLost = true;
    return result;
  }
  const pruned = await pruneOutboxRecords();
  return {
    ...result,
    prunedDeadLetters: pruned.deadLetters,
    prunedDelivered: pruned.delivered,
    prunedReprocessAudits: pruned.reprocessAudits,
  };
};
