import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { markCertificateRenderFailed } from "@/features/certificates/server";
import { deliverOutboxMessage } from "./delivery";
import {
  claimOutboxMessages,
  markOutboxMessageDeadLetter,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  pruneOutboxRecords,
} from "./server";
import { processClaimedOutboxMessage } from "./worker";

const DEFAULT_BATCH_LIMIT = 20;

export interface OutboxWorkerResult {
  deadLettered: number;
  delivered: number;
  prunedDeadLetters: number;
  prunedDelivered: number;
  prunedReprocessAudits: number;
  retried: number;
}

export const runOutboxWorker = async ({
  limit = DEFAULT_BATCH_LIMIT,
  workerId = `outbox-${randomUUID()}`,
}: {
  limit?: number;
  workerId?: string;
} = {}): Promise<OutboxWorkerResult> => {
  const client = await getPool().connect();
  const result: OutboxWorkerResult = {
    deadLettered: 0,
    delivered: 0,
    prunedDeadLetters: 0,
    prunedDelivered: 0,
    prunedReprocessAudits: 0,
    retried: 0,
  };

  try {
    const messages = await claimOutboxMessages({ client, limit, workerId });
    for (const message of messages) {
      const outcome = await processClaimedOutboxMessage({
        deliver: deliverOutboxMessage,
        markDeadLetter: ({ errorCode, id }) =>
          markOutboxMessageDeadLetter({
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
      if (outcome === "delivered") {
        result.delivered += 1;
      } else if (outcome === "retrying") {
        result.retried += 1;
      } else {
        if (message.topic === "certificate.render") {
          await markCertificateRenderFailed(message.aggregateId);
        }
        result.deadLettered += 1;
      }
    }
    const pruned = await pruneOutboxRecords();
    return {
      ...result,
      prunedDeadLetters: pruned.deadLetters,
      prunedDelivered: pruned.delivered,
      prunedReprocessAudits: pruned.reprocessAudits,
    };
  } finally {
    client.release();
  }
};
