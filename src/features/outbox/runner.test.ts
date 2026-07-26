import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delivers each claimed message and reports its terminal result", async () => {
    const client = { query: vi.fn() };
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
      query: client.query,
    });
    dependencies.claimOutboxMessages
      .mockResolvedValueOnce([message])
      .mockResolvedValue([]);
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
      deadlineReached: false,
      delivered: 1,
      leaseLost: false,
      prunedDeadLetters: 0,
      prunedDelivered: 0,
      prunedReprocessAudits: 0,
      retried: 0,
    });

    expect(dependencies.claimOutboxMessages).toHaveBeenCalledWith({
      client,
      limit: 1,
      workerId: "worker-a",
    });
    expect(dependencies.markOutboxMessageDelivered).toHaveBeenCalledWith({
      client,
      id: "outbox-1",
      workerId: "worker-a",
    });
  });

  it("stops before another claim when the invocation budget is exhausted", async () => {
    const client = { query: vi.fn() };
    const now = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(500)
      .mockReturnValue(500);
    dependencies.getPool.mockReturnValue(client);
    dependencies.claimOutboxMessages.mockResolvedValue([]);

    await expect(
      runOutboxWorker({
        deadlineAt: 500,
        now,
        workerId: "worker-a",
      })
    ).resolves.toMatchObject({
      deadlineReached: true,
      delivered: 0,
    });
    expect(dependencies.claimOutboxMessages).toHaveBeenCalledOnce();
    expect(dependencies.pruneOutboxRecords).not.toHaveBeenCalled();
  });

  it("does not claim or prune after losing the durable lease", async () => {
    dependencies.getPool.mockReturnValue({ query: vi.fn() });

    await expect(
      runOutboxWorker({
        shouldContinue: async () => false,
        workerId: "worker-a",
      })
    ).resolves.toMatchObject({
      deadlineReached: false,
      leaseLost: true,
    });

    expect(dependencies.claimOutboxMessages).not.toHaveBeenCalled();
    expect(dependencies.pruneOutboxRecords).not.toHaveBeenCalled();
  });
});
