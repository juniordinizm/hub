import { describe, expect, it, vi } from "vitest";
import { createCertificateIssuedMessage } from "./rules";

vi.mock("server-only", () => ({}));

import {
  claimOutboxMessages,
  enqueueOutboxMessage,
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
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "outbox-1", "Falha transitória confirmada."]
    );
  });
});
