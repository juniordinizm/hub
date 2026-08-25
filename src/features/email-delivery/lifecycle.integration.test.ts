import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  normalizeResendWebhookEvent,
  persistResendWebhookEvent,
} from "./resend-webhook";
import { markEmailAccepted } from "./server";
import { claimResendWebhookEvents, processResendWebhookEvent } from "./worker";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "protea-r-email-lifecycle-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 3,
});

afterAll(async () => {
  await pool.end();
});

const insertEmailMessage = async ({
  correlationId,
  providerMessageId = null,
  status = "sending",
}: {
  correlationId: string;
  providerMessageId?: string | null;
  status?: "accepted" | "sending";
}): Promise<void> => {
  await pool.query(
    `
      insert into email_messages (
        id,
        provider_message_id,
        correlation_id,
        topic,
        template_alias,
        status,
        request_fingerprint,
        accepted_at
      )
      values (
        $1, $2, $1,
        'email.certificate-issued',
        'certificate-issued',
        $3::email_message_status,
        $4,
        case when $3::text = 'accepted' then now() else null end
      )
    `,
    [correlationId, providerMessageId, status, "a".repeat(64)]
  );
};

const persistEvent = async ({
  correlationId,
  providerEventId,
  providerMessageId,
  type,
}: {
  correlationId: string;
  providerEventId: string;
  providerMessageId: string;
  type: string;
}) => {
  const rawBody = JSON.stringify({
    created_at: "2026-08-24T12:00:00.000Z",
    data: {
      email_id: providerMessageId,
      tags: { hub_correlation: correlationId },
    },
    type,
  });
  return await persistResendWebhookEvent({
    client: pool,
    event: normalizeResendWebhookEvent({
      providerEventId,
      rawBody,
      verifiedEvent: JSON.parse(rawBody) as unknown,
    }),
  });
};

const processAll = async (workerId: string): Promise<void> => {
  while (true) {
    const [event] = await claimResendWebhookEvents({
      client: pool,
      limit: 1,
      workerId,
    });
    if (!event) {
      return;
    }
    const client = await pool.connect();
    try {
      await processResendWebhookEvent({ client, event, workerId });
    } finally {
      client.release();
    }
  }
};

const cleanup = async (correlationId: string): Promise<void> => {
  await pool.query(
    "delete from resend_webhook_events where correlation_id = $1",
    [correlationId]
  );
  await pool.query("delete from email_messages where correlation_id = $1", [
    correlationId,
  ]);
};

describe("Resend lifecycle PostgreSQL convergence", () => {
  it("preserves delivered when webhook wins the local acceptance race", async () => {
    const correlationId = randomUUID();
    const providerMessageId = `resend-${randomUUID()}`;
    await insertEmailMessage({ correlationId });
    try {
      await persistEvent({
        correlationId,
        providerEventId: `svix-${randomUUID()}`,
        providerMessageId,
        type: "email.delivered",
      });
      await processAll(`worker-${randomUUID()}`);
      await expect(
        markEmailAccepted({
          client: pool,
          emailMessageId: correlationId,
          providerMessageId,
        })
      ).resolves.toMatchObject({ acceptedAt: expect.any(Date) });
      const state = await pool.query<{
        provider_message_id: string;
        status: string;
      }>(
        "select status, provider_message_id from email_messages where id = $1",
        [correlationId]
      );
      expect(state.rows[0]).toEqual({
        provider_message_id: providerMessageId,
        status: "delivered",
      });
    } finally {
      await cleanup(correlationId);
    }
  });

  it("reduces conflicting events deterministically and deduplicates svix ids", async () => {
    const correlationId = randomUUID();
    const providerMessageId = `resend-${randomUUID()}`;
    await insertEmailMessage({
      correlationId,
      providerMessageId,
      status: "accepted",
    });
    try {
      const providerEventId = `svix-${randomUUID()}`;
      const first = await persistEvent({
        correlationId,
        providerEventId,
        providerMessageId,
        type: "email.failed",
      });
      const duplicate = await persistEvent({
        correlationId,
        providerEventId,
        providerMessageId,
        type: "email.failed",
      });
      expect(first.inserted).toBe(true);
      expect(duplicate.inserted).toBe(false);
      for (const type of [
        "email.bounced",
        "email.delivered",
        "email.complained",
      ]) {
        await persistEvent({
          correlationId,
          providerEventId: `svix-${randomUUID()}`,
          providerMessageId,
          type,
        });
      }
      await processAll(`worker-${randomUUID()}`);
      const state = await pool.query<{
        delivery_event_conflict: boolean;
        last_error_code: string;
        status: string;
      }>(
        `
          select status, delivery_event_conflict, last_error_code
          from email_messages
          where id = $1
        `,
        [correlationId]
      );
      expect(state.rows[0]).toEqual({
        delivery_event_conflict: true,
        last_error_code: "delivery_event_conflict",
        status: "complained",
      });
    } finally {
      await cleanup(correlationId);
    }
  });
});
