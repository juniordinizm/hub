import { describe, expect, it, vi } from "vitest";
import { createCertificateIssuedMessage } from "./rules";

vi.mock("server-only", () => ({}));

import {
  claimOutboxMessages,
  enqueueOutboxMessage,
  markOutboxMessageDeadLetter,
  markOutboxMessageDeferred,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  requeueDeadLetterMessage,
} from "./server";

const SKIP_LOCKED_PATTERN = /for update skip locked/i;

describe("outbox persistence", () => {
  it("inserts a durable intent with a unique idempotency key", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "outbox-1" }] });

    await expect(
      enqueueOutboxMessage({
        client: { query } as never,
        message: createCertificateIssuedMessage({
          certificateId: "certificate-1",
        }),
      })
    ).resolves.toEqual({ id: "outbox-1", inserted: true });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (idempotency_key) do nothing"),
      expect.arrayContaining([
        "email.certificate-issued/certificate-1/v1",
        JSON.stringify({ certificateId: "certificate-1" }),
      ])
    );
  });

  it("claims ready messages with skip locked before delivery", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await claimOutboxMessages({
      client: { query } as never,
      limit: 10,
      workerId: "worker-a",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(SKIP_LOCKED_PATTERN),
      ["worker-a", 10]
    );
  });

  it("defers a message without consuming a delivery attempt", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      markOutboxMessageDeferred({
        client: { query } as never,
        errorCode: "course_sales_closed",
        id: "outbox-1",
        workerId: "worker-a",
      })
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("attempts = greatest(attempts - 1, 0)"),
      ["outbox-1", "worker-a", "course_sales_closed"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("interval '24 hours'"),
      ["outbox-1", "worker-a", "course_sales_closed"]
    );
  });

  it.each([
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDelivered({
          client: { query } as never,
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "delivered",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageForRetry({
          client: { query } as never,
          errorCode: "delivery_failed",
          id: "outbox-1",
          retryDelayMs: 60_000,
          workerId: "worker-a",
        }),
      name: "retry",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDeferred({
          client: { query } as never,
          errorCode: "course_sales_closed",
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "deferred",
    },
    {
      mark: (query: ReturnType<typeof vi.fn>) =>
        markOutboxMessageDeadLetter({
          client: { query } as never,
          errorCode: "delivery_failed",
          id: "outbox-1",
          workerId: "worker-a",
        }),
      name: "dead letter",
    },
  ])("returns false when the $name transition loses ownership", async ({
    mark,
  }) => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(mark(query)).resolves.toBe(false);
    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("status = 'processing'");
    expect(statement).toContain("locked_by = $2");
    expect(query.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining(["outbox-1", "worker-a"])
    );
  });

  it("dead-letters certificate.render and fails its certificate in one fenced statement", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ transitioned: true }],
    });

    await expect(
      markOutboxMessageDeadLetter({
        client: { query } as never,
        errorCode: "certificate_render_failed",
        id: "outbox-1",
        workerId: "worker-a",
      })
    ).resolves.toBe(true);

    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("with transitioned as");
    expect(statement).toContain("message.topic = 'certificate.render'");
    expect(statement).toContain("jsonb_typeof");
    expect(statement).toContain("certificate.id::text");
    expect(statement).not.toContain("::uuid");
    expect(statement).toContain("certificate.render_claim_token is null");
  });

  it("allows exactly one manually audited reprocess", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "outbox-1" }] })
      .mockResolvedValueOnce({ rows: [] });

    await requeueDeadLetterMessage({
      actorUserId: "admin-1",
      client: { query } as never,
      messageId: "outbox-1",
      reason: "Falha transitória confirmada.",
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("manual_reprocess_count = 0"),
      ["outbox-1"]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_status = 'pending'"),
      ["outbox-1"]
    );
    const certificateRequeueStatement = String(query.mock.calls[1]?.[0]);
    expect(certificateRequeueStatement).toContain(
      "message.topic = 'certificate.render'"
    );
    expect(certificateRequeueStatement).toContain("jsonb_typeof");
    expect(certificateRequeueStatement).toContain("certificate.id::text");
    expect(certificateRequeueStatement).not.toContain("::uuid");
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "outbox-1", "Falha transitória confirmada."]
    );
    expect(String(query.mock.calls[2]?.[0])).toContain("$3::text");
  });
});
