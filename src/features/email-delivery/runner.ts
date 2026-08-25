import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { pruneEmailDeliveryRecords } from "./server";
import {
  claimResendWebhookEvents,
  processResendWebhookEvent,
  type ResendWebhookProcessingOutcome,
} from "./worker";

const DEFAULT_LIMIT = 20;

export interface ResendWebhookWorkerResult {
  deadLettered: number;
  deadlineReached: boolean;
  ignored: number;
  leaseLost: boolean;
  processed: number;
  prunedEvents: number;
  prunedMessages: number;
  retried: number;
}

const createResult = (): ResendWebhookWorkerResult => ({
  deadLettered: 0,
  deadlineReached: false,
  ignored: 0,
  leaseLost: false,
  processed: 0,
  prunedEvents: 0,
  prunedMessages: 0,
  retried: 0,
});

const recordOutcome = (
  result: ResendWebhookWorkerResult,
  outcome: ResendWebhookProcessingOutcome
): boolean => {
  if (outcome === "lease_lost") {
    result.leaseLost = true;
    return false;
  }
  if (outcome === "processed") {
    result.processed += 1;
  } else if (outcome === "ignored") {
    result.ignored += 1;
  } else if (outcome === "retrying") {
    result.retried += 1;
  } else {
    result.deadLettered += 1;
  }
  return true;
};

export const runResendWebhookWorker = async ({
  deadlineAt = Number.POSITIVE_INFINITY,
  limit = DEFAULT_LIMIT,
  now = Date.now,
  shouldContinue = async () => true,
  workerId = `resend-webhook-${randomUUID()}`,
}: {
  deadlineAt?: number;
  limit?: number;
  now?: () => number;
  shouldContinue?: () => Promise<boolean>;
  workerId?: string;
} = {}): Promise<ResendWebhookWorkerResult> => {
  const pool = getPool();
  const result = createResult();
  let handled = 0;

  while (handled < limit) {
    if (now() >= deadlineAt) {
      result.deadlineReached = true;
      break;
    }
    if (!(await shouldContinue())) {
      result.leaseLost = true;
      break;
    }
    const [event] = await claimResendWebhookEvents({
      client: pool,
      limit: 1,
      workerId,
    });
    if (!event) {
      break;
    }
    handled += 1;
    const client = await pool.connect();
    let outcome: ResendWebhookProcessingOutcome;
    try {
      outcome = await processResendWebhookEvent({
        client,
        event,
        workerId,
      });
    } finally {
      client.release();
    }
    if (!recordOutcome(result, outcome)) {
      break;
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
  const pruned = await pruneEmailDeliveryRecords({ client: pool });
  return {
    ...result,
    prunedEvents: pruned.events,
    prunedMessages: pruned.messages,
  };
};
