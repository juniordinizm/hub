import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import { createCertificateIssuedMessage } from "./rules";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

vi.mock("server-only", () => ({}));

import { claimOutboxMessages, enqueueOutboxMessage } from "./server";

const pool = new Pool({ connectionString: withVerifiedSslMode(databaseUrl) });

describe("outbox PostgreSQL concurrency", () => {
  beforeEach(async () => {
    await pool.query("truncate table outbox_messages");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enforces one durable intent for a repeated idempotency key", async () => {
    const client = await pool.connect();
    try {
      const message = createCertificateIssuedMessage({
        certificateId: "certificate-1",
      });
      await expect(
        enqueueOutboxMessage({ client, message })
      ).resolves.toMatchObject({
        inserted: true,
      });
      await expect(enqueueOutboxMessage({ client, message })).resolves.toEqual({
        id: null,
        inserted: false,
      });
    } finally {
      client.release();
    }
  });

  it("does not let two workers claim the same ready message", async () => {
    const writer = await pool.connect();
    const firstWorker = await pool.connect();
    const secondWorker = await pool.connect();
    try {
      await enqueueOutboxMessage({
        client: writer,
        message: createCertificateIssuedMessage({
          certificateId: "certificate-1",
        }),
      });

      const [first, second] = await Promise.all([
        claimOutboxMessages({
          client: firstWorker,
          limit: 1,
          workerId: "worker-1",
        }),
        claimOutboxMessages({
          client: secondWorker,
          limit: 1,
          workerId: "worker-2",
        }),
      ]);

      expect(first.length + second.length).toBe(1);
    } finally {
      writer.release();
      firstWorker.release();
      secondWorker.release();
    }
  });

  it("releases an abandoned processing lease to another worker", async () => {
    const writer = await pool.connect();
    const firstWorker = await pool.connect();
    const secondWorker = await pool.connect();
    try {
      await enqueueOutboxMessage({
        client: writer,
        message: createCertificateIssuedMessage({
          certificateId: "certificate-1",
        }),
      });
      const first = await claimOutboxMessages({
        client: firstWorker,
        limit: 1,
        workerId: "worker-1",
      });
      const messageId = first[0]?.id;
      expect(messageId).toBeTruthy();
      await pool.query(
        "update outbox_messages set locked_at = now() - interval '11 minutes' where id = $1",
        [messageId]
      );

      await expect(
        claimOutboxMessages({
          client: secondWorker,
          limit: 1,
          workerId: "worker-2",
        })
      ).resolves.toHaveLength(1);
    } finally {
      writer.release();
      firstWorker.release();
      secondWorker.release();
    }
  });
});
