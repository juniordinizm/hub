import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "@/db";
import type { AsaasBuyerIdentityPreparation } from "./asaas-customer-enrichment";

const DEFAULT_BATCH_LIMIT = 20;
const MAXIMUM_BATCH_LIMIT = 50;
const MAXIMUM_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 60_000;
const SAFE_ERROR_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;

type WebhookQueryClient = Pick<Pool, "query">;

export interface ClaimedAsaasWebhookEvent {
  attemptCount: number;
  eventKey: string;
  eventName: string;
  id: string;
  orderId: string | null;
  payload: unknown;
}

export interface AsaasWebhookProcessorOutcome {
  outcome: "ignored" | "processed";
}

export interface AsaasWebhookProcessingContext {
  client: PoolClient;
  lockOrder: (orderId: string) => Promise<void>;
}

export interface AsaasWebhookProcessor {
  prepare(
    event: ClaimedAsaasWebhookEvent
  ): Promise<AsaasBuyerIdentityPreparation>;
  process(
    event: ClaimedAsaasWebhookEvent,
    context: AsaasWebhookProcessingContext,
    preparation: AsaasBuyerIdentityPreparation
  ): Promise<AsaasWebhookProcessorOutcome>;
}

export class AsaasWebhookProcessingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, { retryable }: { retryable: boolean }) {
    const safeCode = SAFE_ERROR_CODE_PATTERN.test(code)
      ? code
      : "webhook_processing_failed";
    super(safeCode);
    this.name = "AsaasWebhookProcessingError";
    this.code = safeCode;
    this.retryable = retryable;
  }
}

const getProcessingError = (error: unknown): AsaasWebhookProcessingError =>
  error instanceof AsaasWebhookProcessingError
    ? error
    : new AsaasWebhookProcessingError("webhook_processing_failed", {
        retryable: true,
      });

const getRetryDelayMs = (attemptCount: number): number =>
  RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1);

export const claimAsaasWebhookEvents = async ({
  client,
  limit,
  workerId,
}: {
  client: WebhookQueryClient;
  limit: number;
  workerId: string;
}): Promise<ClaimedAsaasWebhookEvent[]> => {
  const boundedLimit = Math.min(
    Math.max(1, Math.trunc(limit)),
    MAXIMUM_BATCH_LIMIT
  );
  const claimed = await client.query<ClaimedAsaasWebhookEvent>(
    `
      with candidates as (
        select id
        from webhook_events
        where provider = 'asaas'
          and attempt_count < $3
          and payload_sanitized_at is null
          and payload_expires_at > now()
          and (
            (
              status in ('received', 'retryable')
              and (next_attempt_at is null or next_attempt_at <= now())
            )
            or (
              status = 'processing'
              and locked_at < now() - interval '10 minutes'
            )
          )
        order by coalesce(next_attempt_at, created_at), created_at
        for update skip locked
        limit $2
      )
      update webhook_events as event
      set status = 'processing',
          attempt_count = event.attempt_count + 1,
          last_attempt_at = now(),
          locked_at = now(),
          locked_by = $1,
          error_message = null,
          updated_at = now()
      from candidates
      where event.id = candidates.id
      returning
        event.id,
        event.event_key as "eventKey",
        event.event_name as "eventName",
        event.order_id as "orderId",
        event.payload,
        event.attempt_count as "attemptCount"
    `,
    [workerId, boundedLimit, MAXIMUM_ATTEMPTS]
  );
  return claimed.rows;
};

export const failExhaustedAsaasWebhookEvents = async ({
  client,
  limit,
}: {
  client: WebhookQueryClient;
  limit: number;
}): Promise<number> => {
  const boundedLimit = Math.min(
    Math.max(1, Math.trunc(limit)),
    MAXIMUM_BATCH_LIMIT
  );
  const exhausted = await client.query(
    `
      with exhausted_events as (
        select id
        from webhook_events
        where provider = 'asaas'
          and status = 'processing'
          and locked_at < now() - interval '10 minutes'
          and attempt_count >= $2
        order by locked_at, created_at
        for update skip locked
        limit $1
      )
      update webhook_events as event
      set status = 'failed',
          next_attempt_at = null,
          locked_at = null,
          locked_by = null,
          error_message = 'webhook_attempts_exhausted',
          updated_at = now()
      from exhausted_events
      where event.id = exhausted_events.id
    `,
    [boundedLimit, MAXIMUM_ATTEMPTS]
  );
  return exhausted.rowCount ?? 0;
};

const markProcessingFailure = async ({
  client,
  error,
  event,
  workerId,
}: {
  client: WebhookQueryClient;
  error: AsaasWebhookProcessingError;
  event: ClaimedAsaasWebhookEvent;
  workerId: string;
}): Promise<"failed" | "retrying"> => {
  const shouldRetry = error.retryable && event.attemptCount < MAXIMUM_ATTEMPTS;
  const result = shouldRetry
    ? await client.query<{ id: string }>(
        `
          update webhook_events
          set status = 'retryable',
              next_attempt_at = now() + ($3 * interval '1 millisecond'),
              locked_at = null,
              locked_by = null,
              error_message = $4,
              updated_at = now()
          where id = $1 and status = 'processing' and locked_by = $2
          returning id
        `,
        [event.id, workerId, getRetryDelayMs(event.attemptCount), error.code]
      )
    : await client.query<{ id: string }>(
        `
          update webhook_events
          set status = 'failed',
              next_attempt_at = null,
              locked_at = null,
              locked_by = null,
              error_message = $3,
              updated_at = now()
          where id = $1 and status = 'processing' and locked_by = $2
          returning id
        `,
        [event.id, workerId, error.code]
      );
  if (!result.rows[0]) {
    throw new Error("Asaas webhook ownership lost.");
  }
  return shouldRetry ? "retrying" : "failed";
};

export const processClaimedAsaasWebhookEvent = async ({
  event,
  pool,
  processor,
  workerId,
}: {
  event: ClaimedAsaasWebhookEvent;
  pool: Pick<Pool, "connect" | "query">;
  processor: AsaasWebhookProcessor;
  workerId: string;
}): Promise<"failed" | "ignored" | "processed" | "retrying"> => {
  let preparation: AsaasBuyerIdentityPreparation;
  try {
    preparation = await processor.prepare(event);
  } catch (error) {
    return await markProcessingFailure({
      client: pool,
      error: getProcessingError(error),
      event,
      workerId,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query<ClaimedAsaasWebhookEvent>(
      `
        select
          id,
          event_key as "eventKey",
          event_name as "eventName",
          order_id as "orderId",
          payload,
          attempt_count as "attemptCount"
        from webhook_events
        where id = $1 and status = 'processing' and locked_by = $2
        for update
      `,
      [event.id, workerId]
    );
    const currentEvent = owned.rows[0];
    if (!currentEvent) {
      throw new Error("Asaas webhook ownership lost.");
    }

    const outcome = await processor.process(
      currentEvent,
      {
        client,
        lockOrder: async (orderId) => {
          const lockedOrder = await client.query<{ id: string }>(
            "select id from orders where id = $1 for update",
            [orderId]
          );
          if (!lockedOrder.rows[0]) {
            throw new AsaasWebhookProcessingError("order_not_found", {
              retryable: false,
            });
          }
        },
      },
      preparation
    );
    const completed = await client.query<{ id: string }>(
      `
        update webhook_events
        set status = $3,
            processed_at = now(),
            next_attempt_at = null,
            locked_at = null,
            locked_by = null,
            error_message = null,
            updated_at = now()
        where id = $1 and status = 'processing' and locked_by = $2
        returning id
      `,
      [currentEvent.id, workerId, outcome.outcome]
    );
    if (!completed.rows[0]) {
      throw new Error("Asaas webhook ownership lost.");
    }
    await client.query("commit");
    return outcome.outcome;
  } catch (error) {
    await client.query("rollback");
    return await markProcessingFailure({
      client,
      error: getProcessingError(error),
      event,
      workerId,
    });
  } finally {
    client.release();
  }
};

export interface AsaasWebhookWorkerResult {
  deadlineReached: boolean;
  failed: number;
  ignored: number;
  leaseLost: boolean;
  processed: number;
  retried: number;
}

export const runAsaasWebhookWorker = async ({
  claim = claimAsaasWebhookEvents,
  deadlineAt = Number.POSITIVE_INFINITY,
  failExhausted = failExhaustedAsaasWebhookEvents,
  limit = DEFAULT_BATCH_LIMIT,
  now = Date.now,
  process = processClaimedAsaasWebhookEvent,
  processor,
  shouldContinue = async () => true,
  workerId = `asaas-webhook-${randomUUID()}`,
}: {
  claim?: typeof claimAsaasWebhookEvents;
  deadlineAt?: number;
  failExhausted?: typeof failExhaustedAsaasWebhookEvents;
  limit?: number;
  now?: () => number;
  process?: typeof processClaimedAsaasWebhookEvent;
  processor: AsaasWebhookProcessor;
  shouldContinue?: () => Promise<boolean>;
  workerId?: string;
}): Promise<AsaasWebhookWorkerResult> => {
  const pool = getPool();
  const boundedLimit = Math.min(
    Math.max(1, Math.trunc(limit)),
    MAXIMUM_BATCH_LIMIT
  );
  const result: AsaasWebhookWorkerResult = {
    deadlineReached: false,
    failed: 0,
    ignored: 0,
    leaseLost: false,
    processed: 0,
    retried: 0,
  };

  if (now() >= deadlineAt) {
    result.deadlineReached = true;
    return result;
  }
  if (!(await shouldContinue())) {
    result.leaseLost = true;
    return result;
  }
  result.failed += await failExhausted({
    client: pool,
    limit: boundedLimit,
  });

  for (let count = 0; count < boundedLimit; count += 1) {
    if (now() >= deadlineAt) {
      result.deadlineReached = true;
      break;
    }
    if (!(await shouldContinue())) {
      result.leaseLost = true;
      break;
    }
    const event = (await claim({ client: pool, limit: 1, workerId }))[0];
    if (!event) {
      break;
    }
    const outcome = await process({ event, pool, processor, workerId });
    if (outcome === "processed") {
      result.processed += 1;
    } else if (outcome === "ignored") {
      result.ignored += 1;
    } else if (outcome === "retrying") {
      result.retried += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
};

export const requeueFailedAsaasWebhook = async ({
  actorUserId,
  eventId,
  reason,
}: {
  actorUserId: string;
  eventId: string;
  reason: string;
}): Promise<void> => {
  const normalizedReason = reason.trim();
  if (!normalizedReason || normalizedReason.length > 500) {
    throw new Error("Invalid Asaas webhook retry reason.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const requeued = await client.query<{ id: string }>(
      `
        update webhook_events
        set status = 'retryable',
            attempt_count = 0,
            next_attempt_at = now(),
            locked_at = null,
            locked_by = null,
            error_message = null,
            updated_at = now()
        where id = $1
          and provider = 'asaas'
          and status = 'failed'
          and payload_sanitized_at is null
          and payload_expires_at > now()
        returning id
      `,
      [eventId]
    );
    if (!requeued.rows[0]) {
      throw new Error("Asaas webhook is not eligible for retry.");
    }
    await client.query(
      `
        insert into audit_logs (
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata
        )
        values (
          $1,
          'asaas_webhook.requeued',
          'webhook_event',
          $2,
          jsonb_build_object('reason', $3)
        )
      `,
      [actorUserId, eventId, normalizedReason]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
