import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  createCertificateIssuedMessage,
  createCertificateRenderMessage,
} from "./rules";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

vi.mock("server-only", () => ({}));

import {
  claimOutboxMessages,
  enqueueOutboxMessage,
  markOutboxMessageDeadLetter,
  requeueDeadLetterMessage,
} from "./server";

const pool = new Pool({ connectionString: withVerifiedSslMode(databaseUrl) });

interface CertificateFixture {
  certificateId: string;
  courseId: string;
  publicationId: string;
  suffix: string;
  userId: string;
}

const createCertificateFixture = async (
  client: PoolClient
): Promise<CertificateFixture> => {
  const fixture = {
    certificateId: randomUUID(),
    courseId: randomUUID(),
    publicationId: randomUUID(),
    suffix: randomUUID(),
    userId: `outbox-user-${randomUUID()}`,
  };
  await client.query(
    `insert into users (id, name, email, email_verified)
     values ($1, 'Outbox Student', $2, true)`,
    [fixture.userId, `outbox-${fixture.suffix}@example.test`]
  );
  await client.query(
    `insert into courses (id, slug, title)
     values ($1, $2, 'Outbox Course')`,
    [fixture.courseId, `outbox-course-${fixture.suffix}`]
  );
  await client.query(
    `insert into course_publications (
       id, course_id, publication_number, title_snapshot
     ) values ($1, $2, 1, 'Outbox Course')`,
    [fixture.publicationId, fixture.courseId]
  );
  await client.query(
    `insert into certificates (
       id,
       user_id,
       course_id,
       course_publication_id,
       code,
       student_name_snapshot,
       course_title_snapshot
     ) values ($1, $2, $3, $4, $5, 'Outbox Student', 'Outbox Course')`,
    [
      fixture.certificateId,
      fixture.userId,
      fixture.courseId,
      fixture.publicationId,
      `PRT-${fixture.suffix}`,
    ]
  );
  return fixture;
};

const deleteCertificateFixture = async (
  client: PoolClient,
  fixture: CertificateFixture
): Promise<void> => {
  await client.query("delete from audit_logs where actor_user_id = $1", [
    fixture.userId,
  ]);
  await client.query("delete from outbox_messages where aggregate_id = $1", [
    fixture.certificateId,
  ]);
  await client.query("delete from certificates where id = $1", [
    fixture.certificateId,
  ]);
  await client.query("delete from courses where id = $1", [fixture.courseId]);
  await client.query("delete from users where id = $1", [fixture.userId]);
};

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

  it("rejects a stale fifth-attempt dead letter without failing the certificate", async () => {
    const writer = await pool.connect();
    const firstWorker = await pool.connect();
    const secondWorker = await pool.connect();
    let fixture: CertificateFixture | undefined;
    try {
      fixture = await createCertificateFixture(writer);
      const enqueued = await enqueueOutboxMessage({
        client: writer,
        message: createCertificateRenderMessage({
          certificateId: fixture.certificateId,
        }),
      });
      expect(enqueued.id).toBeTruthy();
      await writer.query(
        "update outbox_messages set attempts = 4 where id = $1",
        [enqueued.id]
      );

      const firstClaim = await claimOutboxMessages({
        client: firstWorker,
        limit: 1,
        workerId: "worker-a",
      });
      expect(firstClaim[0]?.attempts).toBe(5);
      await writer.query(
        "update outbox_messages set locked_at = now() - interval '11 minutes' where id = $1",
        [enqueued.id]
      );
      await expect(
        claimOutboxMessages({
          client: secondWorker,
          limit: 1,
          workerId: "worker-b",
        })
      ).resolves.toHaveLength(1);

      await expect(
        markOutboxMessageDeadLetter({
          client: firstWorker,
          errorCode: "certificate_render_failed",
          id: String(enqueued.id),
          workerId: "worker-a",
        })
      ).resolves.toBe(false);

      await expect(
        writer.query<{
          locked_by: string;
          render_status: string;
          status: string;
        }>(
          `select message.status,
                  message.locked_by,
                  certificate.render_status
           from outbox_messages as message
           join certificates as certificate on certificate.id = $2
          where message.id = $1`,
          [enqueued.id, fixture.certificateId]
        )
      ).resolves.toMatchObject({
        rows: [
          {
            locked_by: "worker-b",
            render_status: "pending",
            status: "processing",
          },
        ],
      });
    } finally {
      if (fixture) {
        await deleteCertificateFixture(writer, fixture);
      }
      writer.release();
      firstWorker.release();
      secondWorker.release();
    }
  });

  it("atomically dead-letters an owned certificate.render and fails its certificate", async () => {
    const writer = await pool.connect();
    const worker = await pool.connect();
    let fixture: CertificateFixture | undefined;
    try {
      fixture = await createCertificateFixture(writer);
      const enqueued = await enqueueOutboxMessage({
        client: writer,
        message: createCertificateRenderMessage({
          certificateId: fixture.certificateId,
        }),
      });
      await claimOutboxMessages({
        client: worker,
        limit: 1,
        workerId: "worker-a",
      });

      await expect(
        markOutboxMessageDeadLetter({
          client: worker,
          errorCode: "certificate_render_failed",
          id: String(enqueued.id),
          workerId: "worker-a",
        })
      ).resolves.toBe(true);

      await expect(
        writer.query<{
          render_status: string;
          status: string;
        }>(
          `select message.status, certificate.render_status
           from outbox_messages as message
           join certificates as certificate on certificate.id = $2
           where message.id = $1`,
          [enqueued.id, fixture.certificateId]
        )
      ).resolves.toMatchObject({
        rows: [{ render_status: "failed", status: "dead_letter" }],
      });
    } finally {
      if (fixture) {
        await deleteCertificateFixture(writer, fixture);
      }
      writer.release();
      worker.release();
    }
  });

  it("keeps malformed certificate payloads safe across dead-letter and requeue", async () => {
    const writer = await pool.connect();
    const worker = await pool.connect();
    let fixture: CertificateFixture | undefined;
    try {
      fixture = await createCertificateFixture(writer);
      const malformedDeadLetter = await writer.query<{ id: string }>(
        `insert into outbox_messages (
           topic,
           aggregate_type,
           aggregate_id,
           idempotency_key,
           payload_version,
           payload
         ) values ('certificate.render', 'certificate', $1, $2, 1, $3::jsonb)
         returning id`,
        [
          fixture.certificateId,
          `malformed-dead-letter/${fixture.suffix}`,
          JSON.stringify({ certificateId: "not-a-uuid" }),
        ]
      );
      const deadLetterId = malformedDeadLetter.rows[0]?.id;
      expect(deadLetterId).toBeTruthy();
      await claimOutboxMessages({
        client: worker,
        limit: 1,
        workerId: "worker-a",
      });
      await expect(
        markOutboxMessageDeadLetter({
          client: worker,
          errorCode: "unknown_payload_version",
          id: String(deadLetterId),
          workerId: "worker-a",
        })
      ).resolves.toBe(true);
      await expect(
        writer.query<{ render_status: string }>(
          "select render_status from certificates where id = $1",
          [fixture.certificateId]
        )
      ).resolves.toMatchObject({ rows: [{ render_status: "pending" }] });

      await writer.query(
        "update certificates set render_status = 'failed' where id = $1",
        [fixture.certificateId]
      );
      const malformedRequeue = await writer.query<{ id: string }>(
        `insert into outbox_messages (
           topic,
           aggregate_type,
           aggregate_id,
           idempotency_key,
           payload_version,
           payload,
           status
         ) values ('certificate.render', 'certificate', $1, $2, 1, $3::jsonb, 'dead_letter')
         returning id`,
        [
          fixture.certificateId,
          `malformed-requeue/${fixture.suffix}`,
          JSON.stringify({ certificateId: { unexpected: true } }),
        ]
      );
      const requeueId = malformedRequeue.rows[0]?.id;
      expect(requeueId).toBeTruthy();
      await expect(
        requeueDeadLetterMessage({
          actorUserId: fixture.userId,
          client: writer,
          messageId: String(requeueId),
          reason: "Payload malformado para teste.",
        })
      ).resolves.toBeUndefined();
      await expect(
        writer.query<{
          render_status: string;
          status: string;
        }>(
          `select message.status, certificate.render_status
           from outbox_messages as message
           join certificates as certificate on certificate.id = $2
           where message.id = $1`,
          [requeueId, fixture.certificateId]
        )
      ).resolves.toMatchObject({
        rows: [{ render_status: "failed", status: "retrying" }],
      });
    } finally {
      if (fixture) {
        await deleteCertificateFixture(writer, fixture);
      }
      writer.release();
      worker.release();
    }
  });
});
