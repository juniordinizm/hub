import type { Pool, PoolClient } from "pg";
import {
  type EmailDeliveryEvent,
  type EmailMessageStatus,
  mapResendEventType,
  projectEmailMessageStatus,
} from "./rules";

type QueryClient = Pick<Pool, "query">;

export interface ClaimedResendWebhookEvent {
  attempts: number;
  correlationId: string | null;
  eventType: string;
  id: string;
  occurredAt: Date;
  providerEventId: string;
  providerMessageId: string | null;
}

export type ResendWebhookProcessingOutcome =
  | "dead_letter"
  | "ignored"
  | "lease_lost"
  | "processed"
  | "retrying";

const MAXIMUM_ATTEMPTS = 12;
const MAXIMUM_UNMATCHED_AGE_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_RETRY_DELAY_MS = 2 * 60 * 60 * 1000;

export const claimResendWebhookEvents = async ({
  client,
  limit,
  workerId,
}: {
  client: QueryClient;
  limit: number;
  workerId: string;
}): Promise<ClaimedResendWebhookEvent[]> => {
  const result = await client.query<ClaimedResendWebhookEvent>(
    `
      with candidates as (
        select id
        from resend_webhook_events
        where (
          status in ('received', 'retrying') and available_at <= now()
        ) or (
          status = 'processing' and locked_at < now() - interval '10 minutes'
        )
        order by available_at, received_at
        for update skip locked
        limit $2
      )
      update resend_webhook_events as event
      set status = 'processing',
          attempts = event.attempts + 1,
          locked_at = now(),
          locked_by = $1,
          updated_at = now()
      from candidates
      where event.id = candidates.id
      returning
        event.id,
        event.provider_event_id as "providerEventId",
        event.provider_message_id as "providerMessageId",
        event.correlation_id as "correlationId",
        event.event_type as "eventType",
        event.occurred_at as "occurredAt",
        event.attempts
    `,
    [workerId, limit]
  );
  return result.rows;
};

const retryDelayMs = (attempts: number): number =>
  Math.min(60_000 * 2 ** Math.max(0, attempts - 1), MAXIMUM_RETRY_DELAY_MS);

const transitionUnmatchedEvent = async ({
  client,
  event,
  workerId,
}: {
  client: Pick<PoolClient, "query">;
  event: ClaimedResendWebhookEvent;
  workerId: string;
}): Promise<"dead_letter" | "lease_lost" | "retrying"> => {
  const exhausted =
    event.attempts >= MAXIMUM_ATTEMPTS ||
    Date.now() - event.occurredAt.getTime() >= MAXIMUM_UNMATCHED_AGE_MS;
  const status = exhausted ? "dead_letter" : "retrying";
  const result = await client.query(
    exhausted
      ? `
          update resend_webhook_events
          set status = 'dead_letter',
              locked_at = null,
              locked_by = null,
              last_error_code = 'email_message_unresolved',
              updated_at = now()
          where id = $1 and status = 'processing' and locked_by = $2
        `
      : `
          update resend_webhook_events
          set status = 'retrying',
              available_at = now() + ($3 * interval '1 millisecond'),
              locked_at = null,
              locked_by = null,
              last_error_code = 'email_message_pending',
              updated_at = now()
          where id = $1 and status = 'processing' and locked_by = $2
        `,
    exhausted
      ? [event.id, workerId]
      : [event.id, workerId, retryDelayMs(event.attempts)]
  );
  return result.rowCount === 1 ? status : "lease_lost";
};

interface EmailMessageRow {
  id: string;
  status: EmailMessageStatus;
}

interface TimelineRow {
  event_type: string;
  occurred_at: Date;
  provider_event_id: string;
}

const earliestEventAt = (
  timeline: readonly TimelineRow[],
  eventType: string
): Date | null =>
  timeline
    .filter((event) => event.event_type === eventType)
    .map((event) => event.occurred_at)
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

const latestEventAt = (timeline: readonly TimelineRow[]): Date | null =>
  timeline
    .map((event) => event.occurred_at)
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

const markEventTerminal = async ({
  client,
  emailMessageId,
  eventId,
  status,
  workerId,
}: {
  client: Pick<PoolClient, "query">;
  emailMessageId: string;
  eventId: string;
  status: "ignored" | "processed";
  workerId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `
      update resend_webhook_events
      set status = $3,
          email_message_id = $4,
          processed_at = now(),
          locked_at = null,
          locked_by = null,
          last_error_code = null,
          updated_at = now()
      where id = $1 and status = 'processing' and locked_by = $2
    `,
    [eventId, workerId, status, emailMessageId]
  );
  return result.rowCount === 1;
};

export const processResendWebhookEvent = async ({
  client,
  event,
  workerId,
}: {
  client: Pick<PoolClient, "query">;
  event: ClaimedResendWebhookEvent;
  workerId: string;
}): Promise<ResendWebhookProcessingOutcome> => {
  await client.query("begin");
  try {
    const messageResult = await client.query<EmailMessageRow>(
      `
        select id, status
        from email_messages
        where ($1::text is not null and provider_message_id = $1)
           or ($2::uuid is not null and correlation_id = $2)
        order by (provider_message_id = $1) desc
        limit 1
        for update
      `,
      [event.providerMessageId, event.correlationId]
    );
    const message = messageResult.rows[0];
    if (!message) {
      const outcome = await transitionUnmatchedEvent({
        client,
        event,
        workerId,
      });
      await client.query("commit");
      return outcome;
    }

    if (!mapResendEventType(event.eventType)) {
      const transitioned = await markEventTerminal({
        client,
        emailMessageId: message.id,
        eventId: event.id,
        status: "ignored",
        workerId,
      });
      await client.query(transitioned ? "commit" : "rollback");
      return transitioned ? "ignored" : "lease_lost";
    }

    const timelineResult = await client.query<TimelineRow>(
      `
        select provider_event_id, event_type, occurred_at
        from resend_webhook_events
        where (
          email_message_id = $1
          or provider_message_id = $2
          or correlation_id = $3
        )
          and status <> 'dead_letter'
        order by provider_event_id
      `,
      [message.id, event.providerMessageId, event.correlationId]
    );
    const projectionEvents: EmailDeliveryEvent[] = timelineResult.rows.map(
      (item) => ({
        occurredAt: item.occurred_at.toISOString(),
        providerEventId: item.provider_event_id,
        type: item.event_type,
      })
    );
    const projection = projectEmailMessageStatus({
      events: projectionEvents,
      localStatus: message.status,
    });
    await client.query(
      `
        update email_messages
        set status = $2,
            provider_message_id = coalesce(provider_message_id, $3),
            latest_event_at = greatest(coalesce(latest_event_at, $4), $4),
            accepted_at = coalesce(accepted_at, $5),
            delayed_at = coalesce(delayed_at, $6),
            delivered_at = coalesce(delivered_at, $7),
            failed_at = coalesce(failed_at, $8),
            suppressed_at = coalesce(suppressed_at, $9),
            bounced_at = coalesce(bounced_at, $10),
            complained_at = coalesce(complained_at, $11),
            delivery_event_conflict = $12,
            last_error_code = case
              when $12 then 'delivery_event_conflict'
              when last_error_code = 'delivery_event_conflict' then null
              else last_error_code
            end,
            updated_at = now()
        where id = $1
      `,
      [
        message.id,
        projection.status,
        event.providerMessageId,
        latestEventAt(timelineResult.rows),
        earliestEventAt(timelineResult.rows, "email.sent"),
        earliestEventAt(timelineResult.rows, "email.delivery_delayed"),
        earliestEventAt(timelineResult.rows, "email.delivered"),
        earliestEventAt(timelineResult.rows, "email.failed"),
        earliestEventAt(timelineResult.rows, "email.suppressed"),
        earliestEventAt(timelineResult.rows, "email.bounced"),
        earliestEventAt(timelineResult.rows, "email.complained"),
        projection.conflict,
      ]
    );
    const transitioned = await markEventTerminal({
      client,
      emailMessageId: message.id,
      eventId: event.id,
      status: "processed",
      workerId,
    });
    await client.query(transitioned ? "commit" : "rollback");
    return transitioned ? "processed" : "lease_lost";
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original processing error.
    }
    throw error;
  }
};
