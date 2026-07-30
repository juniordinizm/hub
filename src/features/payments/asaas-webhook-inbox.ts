import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { getPool } from "@/db";
import { parseAsaasWebhookEnvelope } from "./asaas-financial-events";

const MINIMUM_WEBHOOK_TOKEN_LENGTH = 32;

type WebhookQueryClient = Pick<Pool, "query">;

export class AsaasWebhookInputError extends Error {
  constructor() {
    super("Invalid Asaas webhook.");
    this.name = "AsaasWebhookInputError";
  }
}

const digestToken = (token: string): Buffer =>
  createHash("sha256").update(token, "utf8").digest();

export const verifyAsaasWebhookToken = ({
  expectedToken,
  receivedToken,
}: {
  expectedToken: string | undefined;
  receivedToken: string | null;
}): boolean => {
  const expected = expectedToken?.trim();
  if (
    !expected ||
    expected.length < MINIMUM_WEBHOOK_TOKEN_LENGTH ||
    !receivedToken
  ) {
    return false;
  }

  return timingSafeEqual(digestToken(expected), digestToken(receivedToken));
};

export const persistAsaasWebhook = async ({
  client = getPool(),
  payload,
}: {
  client?: WebhookQueryClient;
  payload: unknown;
}): Promise<{ duplicate: boolean; id: string | null }> => {
  const envelope = parseAsaasWebhookEnvelope(payload);
  if (!envelope) {
    throw new AsaasWebhookInputError();
  }

  const inserted = await client.query<{ id: string }>(
    `
      insert into webhook_events (
        provider,
        event_key,
        event_name,
        status,
        payload,
        payload_expires_at
      )
      values (
        'asaas',
        $1,
        $2,
        'received',
        $3::jsonb,
        now() + interval '30 days'
      )
      on conflict (provider, event_key) do nothing
      returning id
    `,
    [envelope.key, envelope.event, JSON.stringify(payload)]
  );
  const id = inserted.rows[0]?.id ?? null;
  return { duplicate: id === null, id };
};

export const sanitizeExpiredAsaasWebhookPayloads = async ({
  client = getPool(),
  limit = 500,
}: {
  client?: WebhookQueryClient;
  limit?: number;
} = {}): Promise<number> => {
  const boundedLimit = Math.min(Math.max(1, Math.trunc(limit)), 500);
  const sanitized = await client.query(
    `
      with expired_payloads as (
        select id
        from webhook_events
        where provider = 'asaas'
          and payload_expires_at <= now()
          and payload_sanitized_at is null
          and (
            status <> 'processing'
            or locked_at < now() - interval '10 minutes'
          )
        order by payload_expires_at
        limit $1
        for update skip locked
      )
      update webhook_events as event
      set payload = '{}'::jsonb,
          payload_sanitized_at = now(),
          status = case
            when event.status in ('received', 'retryable', 'processing')
              then 'failed'::webhook_status
            else event.status
          end,
          next_attempt_at = case
            when event.status in ('received', 'retryable', 'processing') then null
            else event.next_attempt_at
          end,
          locked_at = case
            when event.status in ('received', 'retryable', 'processing') then null
            else event.locked_at
          end,
          locked_by = case
            when event.status in ('received', 'retryable', 'processing') then null
            else event.locked_by
          end,
          error_message = case
            when event.status in ('received', 'retryable', 'processing')
              then 'webhook_payload_expired'
            else event.error_message
          end,
          updated_at = now()
      from expired_payloads
      where event.id = expired_payloads.id
    `,
    [boundedLimit]
  );
  return sanitized.rowCount ?? 0;
};
