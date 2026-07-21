import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  claimOutboxMessages: vi.fn(),
  deliverOutboxMessage: vi.fn(),
  getPool: vi.fn(),
  markOutboxMessageDeadLetter: vi.fn(),
  markOutboxMessageDelivered: vi.fn(),
  markOutboxMessageForRetry: vi.fn(),
  pruneOutboxRecords: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("./delivery", () => ({
  deliverOutboxMessage: dependencies.deliverOutboxMessage,
}));
vi.mock("./server", () => ({
  claimOutboxMessages: dependencies.claimOutboxMessages,
  markOutboxMessageDeadLetter: dependencies.markOutboxMessageDeadLetter,
  markOutboxMessageDelivered: dependencies.markOutboxMessageDelivered,
  markOutboxMessageForRetry: dependencies.markOutboxMessageForRetry,
  pruneOutboxRecords: dependencies.pruneOutboxRecords,
}));

import { runOutboxWorker } from "./runner";

describe("outbox runner", () => {
  it("delivers each claimed message and reports its terminal result", async () => {
    const release = vi.fn();
    const client = { release };
    const message = {
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "email.certificate-issued" as const,
    };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    });
    dependencies.claimOutboxMessages.mockResolvedValue([message]);
    dependencies.deliverOutboxMessage.mockResolvedValue(undefined);
    dependencies.markOutboxMessageDelivered.mockResolvedValue(undefined);
    dependencies.pruneOutboxRecords.mockResolvedValue({
      deadLetters: 0,
      delivered: 0,
      reprocessAudits: 0,
    });

    await expect(
      runOutboxWorker({ limit: 10, workerId: "worker-a" })
    ).resolves.toEqual({
      deadLettered: 0,
      delivered: 1,
      prunedDeadLetters: 0,
      prunedDelivered: 0,
      prunedReprocessAudits: 0,
      retried: 0,
    });

    expect(dependencies.claimOutboxMessages).toHaveBeenCalledWith({
      client,
      limit: 10,
      workerId: "worker-a",
    });
    expect(dependencies.markOutboxMessageDelivered).toHaveBeenCalledWith({
      client,
      id: "outbox-1",
      workerId: "worker-a",
    });
    expect(release).toHaveBeenCalledOnce();
  });
});
