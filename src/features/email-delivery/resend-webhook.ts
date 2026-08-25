import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export interface NormalizedResendWebhookEvent {
  correlationId: string | null;
  eventType: string;
  lastErrorCode?: "invalid_event_schema";
  occurredAt: Date;
  payloadSha256: string;
  providerEventId: string;
  providerMessageId: string | null;
  status: "dead_letter" | "received";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const payloadSha256 = (rawBody: string): string =>
  createHash("sha256").update(rawBody, "utf8").digest("hex");

const invalidEvent = ({
  providerEventId,
  rawBody,
  receivedAt,
}: {
  providerEventId: string;
  rawBody: string;
  receivedAt: Date;
}): NormalizedResendWebhookEvent => ({
  correlationId: null,
  eventType: "invalid",
  lastErrorCode: "invalid_event_schema",
  occurredAt: receivedAt,
  payloadSha256: payloadSha256(rawBody),
  providerEventId,
  providerMessageId: null,
  status: "dead_letter",
});

export const normalizeResendWebhookEvent = ({
  providerEventId,
  rawBody,
  receivedAt = new Date(),
  verifiedEvent,
}: {
  providerEventId: string;
  rawBody: string;
  receivedAt?: Date;
  verifiedEvent: unknown;
}): NormalizedResendWebhookEvent => {
  if (!(providerEventId.trim() && isRecord(verifiedEvent))) {
    return invalidEvent({ providerEventId, rawBody, receivedAt });
  }
  const type = verifiedEvent.type;
  const createdAt = verifiedEvent.created_at;
  const data = verifiedEvent.data;
  if (
    typeof type !== "string" ||
    !type ||
    typeof createdAt !== "string" ||
    !isRecord(data) ||
    typeof data.email_id !== "string" ||
    !data.email_id
  ) {
    return invalidEvent({ providerEventId, rawBody, receivedAt });
  }
  const occurredAt = new Date(createdAt);
  if (
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt.toISOString() !== createdAt
  ) {
    return invalidEvent({ providerEventId, rawBody, receivedAt });
  }
  const tags = isRecord(data.tags) ? data.tags : null;
  const correlationTag = tags?.hub_correlation;
  const correlationId =
    typeof correlationTag === "string" && UUID_PATTERN.test(correlationTag)
      ? correlationTag
      : null;

  return {
    correlationId,
    eventType: type,
    occurredAt,
    payloadSha256: payloadSha256(rawBody),
    providerEventId,
    providerMessageId: data.email_id,
    status: "received",
  };
};

export const persistResendWebhookEvent = async ({
  client,
  event,
}: {
  client: Pick<PoolClient, "query">;
  event: NormalizedResendWebhookEvent;
}): Promise<{ id: string | null; inserted: boolean }> => {
  const result = await client.query<{ id: string }>(
    `
      insert into resend_webhook_events (
        provider_event_id,
        provider_message_id,
        correlation_id,
        event_type,
        occurred_at,
        payload_sha256,
        status,
        last_error_code
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (provider_event_id) do nothing
      returning id
    `,
    [
      event.providerEventId,
      event.providerMessageId,
      event.correlationId,
      event.eventType,
      event.occurredAt,
      event.payloadSha256,
      event.status,
      event.lastErrorCode ?? null,
    ]
  );
  const id = result.rows[0]?.id ?? null;
  return { id, inserted: Boolean(id) };
};
