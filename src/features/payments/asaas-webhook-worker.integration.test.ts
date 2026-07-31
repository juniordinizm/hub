import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

vi.mock("server-only", () => ({}));

import {
  persistAsaasWebhook,
  sanitizeExpiredAsaasWebhookPayloads,
} from "./asaas-webhook-inbox";
import {
  AsaasWebhookProcessingError,
  claimAsaasWebhookEvents,
  failExhaustedAsaasWebhookEvents,
  processClaimedAsaasWebhookEvent,
} from "./asaas-webhook-worker";

const EVENT_KEY_PREFIX = "it-asaas-webhook-";
const pool = new Pool({ connectionString: withVerifiedSslMode(databaseUrl) });

const insertEvent = async (): Promise<string> => {
  const eventKey = `${EVENT_KEY_PREFIX}${randomUUID()}`;
  const inserted = await persistAsaasWebhook({
    client: pool,
    payload: {
      event: "PAYMENT_RECEIVED",
      id: eventKey,
      payment: {
        billingType: "PIX",
        id: `pay-${randomUUID()}`,
        status: "RECEIVED",
        value: 10,
      },
    },
  });
  if (!inserted.id) {
    throw new Error("Expected a new Asaas webhook integration fixture.");
  }
  return inserted.id;
};

describe("Asaas webhook PostgreSQL concurrency", () => {
  beforeEach(async () => {
    await pool.query(
      "delete from webhook_events where provider = 'asaas' and event_key like $1",
      [`${EVENT_KEY_PREFIX}%`]
    );
  });

  afterAll(async () => {
    await pool.query(
      "delete from webhook_events where provider = 'asaas' and event_key like $1",
      [`${EVENT_KEY_PREFIX}%`]
    );
    await pool.end();
  });

  it("lets two workers produce one claimed and committed effect", async () => {
    const eventId = await insertEvent();
    const firstWorker = await pool.connect();
    const secondWorker = await pool.connect();
    try {
      const [firstClaim, secondClaim] = await Promise.all([
        claimAsaasWebhookEvents({
          client: firstWorker,
          limit: 1,
          workerId: "integration-worker-1",
        }),
        claimAsaasWebhookEvents({
          client: secondWorker,
          limit: 1,
          workerId: "integration-worker-2",
        }),
      ]);
      expect(firstClaim.length + secondClaim.length).toBe(1);

      const claimed = firstClaim[0] ?? secondClaim[0];
      const workerId =
        firstClaim.length === 1
          ? "integration-worker-1"
          : "integration-worker-2";
      if (!claimed) {
        throw new Error("Expected one claimed Asaas event.");
      }
      const process = vi.fn(async (_event, { client }) => {
        await client.query(
          "update webhook_events set event_name = 'PAYMENT_EFFECT_APPLIED' where id = $1",
          [eventId]
        );
        return { outcome: "processed" as const };
      });
      const processor = {
        prepare: vi.fn(async () => ({ kind: "not_required" as const })),
        process,
      };

      await expect(
        processClaimedAsaasWebhookEvent({
          event: claimed,
          pool,
          processor,
          workerId,
        })
      ).resolves.toBe("processed");

      const persisted = await pool.query<{
        attempt_count: number;
        event_name: string;
        status: string;
      }>(
        "select status, attempt_count, event_name from webhook_events where id = $1",
        [eventId]
      );
      expect(process).toHaveBeenCalledOnce();
      expect(persisted.rows[0]).toEqual({
        attempt_count: 1,
        event_name: "PAYMENT_EFFECT_APPLIED",
        status: "processed",
      });
    } finally {
      firstWorker.release();
      secondWorker.release();
    }
  });

  it("rolls back processor writes before recording a retry", async () => {
    const eventId = await insertEvent();
    const [claimed] = await claimAsaasWebhookEvents({
      client: pool,
      limit: 1,
      workerId: "integration-rollback-worker",
    });
    if (!claimed) {
      throw new Error("Expected one claimed Asaas event.");
    }

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimed,
        pool,
        processor: {
          prepare: vi.fn(async () => ({ kind: "not_required" as const })),
          process: async (_event, { client }) => {
            await client.query(
              "update webhook_events set event_name = 'MUTATED' where id = $1",
              [eventId]
            );
            throw new AsaasWebhookProcessingError("integration_retry", {
              retryable: true,
            });
          },
        },
        workerId: "integration-rollback-worker",
      })
    ).resolves.toBe("retrying");

    const persisted = await pool.query<{
      error_message: string;
      event_name: string;
      status: string;
    }>(
      "select event_name, status, error_message from webhook_events where id = $1",
      [eventId]
    );
    expect(persisted.rows[0]).toEqual({
      error_message: "integration_retry",
      event_name: "PAYMENT_RECEIVED",
      status: "retryable",
    });
  });

  it("rejects completion after ownership is lost", async () => {
    const eventId = await insertEvent();
    const [claimed] = await claimAsaasWebhookEvents({
      client: pool,
      limit: 1,
      workerId: "integration-original-worker",
    });
    if (!claimed) {
      throw new Error("Expected one claimed Asaas event.");
    }
    await pool.query(
      "update webhook_events set locked_by = 'integration-new-worker' where id = $1",
      [eventId]
    );

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimed,
        pool,
        processor: {
          prepare: vi.fn(async () => ({ kind: "not_required" as const })),
          process: vi.fn(),
        },
        workerId: "integration-original-worker",
      })
    ).rejects.toThrow("Asaas webhook ownership lost.");
  });

  it("terminalizes a stale fifth attempt without a sixth claim", async () => {
    const eventId = await insertEvent();
    await pool.query(
      `
        update webhook_events
        set status = 'processing',
            attempt_count = 5,
            locked_at = now() - interval '11 minutes',
            locked_by = 'integration-abandoned-worker'
        where id = $1
      `,
      [eventId]
    );
    const terminalizer = await pool.connect();
    const claimant = await pool.connect();
    try {
      const [failed, claimed] = await Promise.all([
        failExhaustedAsaasWebhookEvents({
          client: terminalizer,
          limit: 1,
        }),
        claimAsaasWebhookEvents({
          client: claimant,
          limit: 1,
          workerId: "integration-sixth-worker",
        }),
      ]);
      expect(failed).toBe(1);
      expect(claimed).toHaveLength(0);

      const persisted = await pool.query<{
        attempt_count: number;
        error_message: string;
        status: string;
      }>(
        "select status, attempt_count, error_message from webhook_events where id = $1",
        [eventId]
      );
      expect(persisted.rows[0]).toEqual({
        attempt_count: 5,
        error_message: "webhook_attempts_exhausted",
        status: "failed",
      });
    } finally {
      terminalizer.release();
      claimant.release();
    }
  });

  it("sanitizes and terminalizes every expired nonterminal state", async () => {
    const receivedId = await insertEvent();
    const retryableId = await insertEvent();
    const processingId = await insertEvent();
    await pool.query(
      `
        update webhook_events
        set payload_expires_at = now() - interval '1 minute'
        where id = $1
      `,
      [receivedId]
    );
    await pool.query(
      `
        update webhook_events
        set status = 'retryable',
            next_attempt_at = now() + interval '1 minute',
            payload_expires_at = now() - interval '1 minute'
        where id = $1
      `,
      [retryableId]
    );
    await pool.query(
      `
        update webhook_events
        set status = 'processing',
            locked_at = now() - interval '11 minutes',
            locked_by = 'integration-expired-worker',
            payload_expires_at = now() - interval '1 minute'
        where id = $1
      `,
      [processingId]
    );

    await expect(
      sanitizeExpiredAsaasWebhookPayloads({ client: pool, limit: 10 })
    ).resolves.toBe(3);

    const persisted = await pool.query<{
      error_message: string;
      locked_at: Date | null;
      locked_by: string | null;
      next_attempt_at: Date | null;
      payload: unknown;
      status: string;
    }>(
      `
        select status, payload, next_attempt_at, locked_at, locked_by, error_message
        from webhook_events
        where id = any($1::uuid[])
        order by id
      `,
      [[receivedId, retryableId, processingId]]
    );
    expect(persisted.rows).toHaveLength(3);
    for (const event of persisted.rows) {
      expect(event).toEqual({
        error_message: "webhook_payload_expired",
        locked_at: null,
        locked_by: null,
        next_attempt_at: null,
        payload: {},
        status: "failed",
      });
    }
  });
});
