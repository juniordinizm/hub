import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  claimAsaasWebhookEvents: vi.fn(),
  failExhaustedAsaasWebhookEvents: vi.fn(),
  getPool: vi.fn(),
  processClaimedAsaasWebhookEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import {
  AsaasWebhookProcessingError,
  claimAsaasWebhookEvents,
  failExhaustedAsaasWebhookEvents,
  processClaimedAsaasWebhookEvent,
  requeueFailedAsaasWebhook,
  runAsaasWebhookWorker,
} from "./asaas-webhook-worker";

const claimedEvent = {
  attemptCount: 1,
  eventKey: "evt_1",
  eventName: "PAYMENT_RECEIVED",
  id: "event-1",
  orderId: "order-1",
  payload: { event: "PAYMENT_RECEIVED", id: "evt_1" },
};

describe("Asaas webhook worker persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a bounded batch with stale-lock recovery and event ownership", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [claimedEvent] });

    await expect(
      claimAsaasWebhookEvents({
        client: { query } as never,
        limit: 20,
        workerId: "worker-a",
      })
    ).resolves.toEqual([claimedEvent]);

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("status in ('received', 'retryable')");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain("payload_sanitized_at is null");
    expect(sql).toContain("payload_expires_at > now()");
    expect(sql).toContain("locked_at < now() - interval '10 minutes'");
    expect(sql).toContain("locked_by = $1");
    expect(sql).toContain("attempt_count = event.attempt_count + 1");
    expect(sql).toContain("attempt_count < $3");
    expect(query).toHaveBeenCalledWith(expect.any(String), ["worker-a", 20, 5]);
  });

  it("terminalizes a stale fifth attempt without claiming or processing it again", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });

    await expect(
      failExhaustedAsaasWebhookEvents({
        client: { query } as never,
        limit: 20,
      })
    ).resolves.toBe(1);

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("attempt_count >= $2");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain("locked_at < now() - interval '10 minutes'");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain("error_message = 'webhook_attempts_exhausted'");
    expect(query).toHaveBeenCalledWith(expect.any(String), [20, 5]);
  });

  it("completes processing in one transaction and exposes an order row-lock contract", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [claimedEvent] })
      .mockResolvedValueOnce({ rows: [{ id: "order-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });
    const process = vi.fn(async (_event, context) => {
      await context.lockOrder("order-1");
      return { outcome: "processed" as const };
    });
    const processor = {
      prepare: vi.fn(async () => ({ kind: "not_required" as const })),
      process,
    };

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimedEvent,
        pool: { connect, query: vi.fn() } as never,
        processor,
        workerId: "worker-a",
      })
    ).resolves.toBe("processed");

    expect(String(query.mock.calls[1]?.[0])).toContain("for update");
    expect(String(query.mock.calls[2]?.[0])).toContain(
      "select id from orders where id = $1 for update"
    );
    expect(String(query.mock.calls[3]?.[0])).toContain("status = $3");
    expect(String(query.mock.calls[3]?.[0])).toContain("locked_by = $2");
    expect(query.mock.calls[3]?.[1]).toEqual([
      "event-1",
      "worker-a",
      "processed",
    ]);
    expect(query).toHaveBeenNthCalledWith(5, "commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("prepares before connecting and passes the preparation into transactional processing", async () => {
    const calls: string[] = [];
    const preparation = { kind: "not_required" as const };
    const prepare = vi.fn(() => {
      calls.push("prepare");
      calls.push("provider:getCustomer");
      return Promise.resolve(preparation);
    });
    const process = vi.fn((_event, _context, receivedPreparation) => {
      calls.push("processor.process");
      expect(receivedPreparation).toBe(preparation);
      return Promise.resolve({ outcome: "processed" as const });
    });
    const query = vi.fn((text: string) => {
      if (text === "begin") {
        calls.push("begin");
        return Promise.resolve({ rows: [] });
      }
      if (text === "commit") {
        calls.push("commit");
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("from webhook_events")) {
        return Promise.resolve({ rows: [claimedEvent] });
      }
      return Promise.resolve({ rows: [{ id: "event-1" }] });
    });
    const connect = vi.fn(() => {
      calls.push("pool:connect");
      return Promise.resolve({ query, release: vi.fn() });
    });

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimedEvent,
        pool: { connect, query: vi.fn() } as never,
        processor: { prepare, process },
        workerId: "worker-a",
      })
    ).resolves.toBe("processed");

    expect(calls).toEqual([
      "prepare",
      "provider:getCustomer",
      "pool:connect",
      "begin",
      "processor.process",
      "commit",
    ]);
    expect(process).toHaveBeenCalledWith(
      claimedEvent,
      expect.objectContaining({ client: expect.any(Object) }),
      preparation
    );
  });

  it("commits conservative effects before scheduling an enrichment retry", async () => {
    const query = vi.fn((text: string, _values?: unknown[]) => {
      if (text.includes("from webhook_events")) {
        return Promise.resolve({ rows: [claimedEvent] });
      }
      return Promise.resolve({ rows: [{ id: "event-1" }] });
    });
    const release = vi.fn();
    const processor = {
      prepare: vi.fn(async () => ({ kind: "not_required" as const })),
      process: vi.fn(async () => ({
        errorCode: "installment_enrichment_failed",
        outcome: "retry" as const,
      })),
    };

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimedEvent,
        pool: {
          connect: vi.fn().mockResolvedValue({ query, release }),
          query: vi.fn(),
        } as never,
        processor,
        workerId: "worker-a",
      })
    ).resolves.toBe("retrying");

    const retryCall = query.mock.calls.find(([text]) =>
      text.includes("status = 'retryable'")
    );
    expect(retryCall?.[1]).toEqual([
      "event-1",
      "worker-a",
      60_000,
      "installment_enrichment_failed",
    ]);
    expect(query).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("commits conservative effects and terminalizes an exhausted enrichment retry", async () => {
    const exhaustedEvent = { ...claimedEvent, attemptCount: 5 };
    const query = vi.fn((text: string, _values?: unknown[]) => {
      if (text.includes("from webhook_events")) {
        return Promise.resolve({ rows: [exhaustedEvent] });
      }
      return Promise.resolve({ rows: [{ id: "event-1" }] });
    });
    const processor = {
      prepare: vi.fn(async () => ({ kind: "not_required" as const })),
      process: vi.fn(async () => ({
        errorCode: "installment_enrichment_failed",
        outcome: "retry" as const,
      })),
    };

    await expect(
      processClaimedAsaasWebhookEvent({
        event: exhaustedEvent,
        pool: {
          connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
          query: vi.fn(),
        } as never,
        processor,
        workerId: "worker-a",
      })
    ).resolves.toBe("failed");

    expect(
      query.mock.calls.some(([text]) => text.includes("status = 'failed'"))
    ).toBe(true);
    expect(query).toHaveBeenLastCalledWith("commit");
  });

  it("marks a retryable preparation failure through the pool without opening a transaction", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "event-1" }] });
    const connect = vi.fn();
    const processor = {
      prepare: vi.fn().mockRejectedValue(
        new AsaasWebhookProcessingError("asaas_customer_timeout", {
          retryable: true,
        })
      ),
      process: vi.fn(),
    };

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimedEvent,
        pool: { connect, query } as never,
        processor,
        workerId: "worker-a",
      })
    ).resolves.toBe("retrying");

    expect(connect).not.toHaveBeenCalled();
    expect(processor.process).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'retryable'");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "event-1",
      "worker-a",
      60_000,
      "asaas_customer_timeout",
    ]);
    expect(query.mock.calls.flat()).not.toContain("begin");
  });

  it("marks a retry with exponential backoff and only a safe error code", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [claimedEvent] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] });
    const client = { query, release: vi.fn() };
    const processor = {
      prepare: vi.fn(async () => ({ kind: "not_required" as const })),
      process: vi.fn().mockRejectedValue(
        new AsaasWebhookProcessingError("order_not_ready", {
          retryable: true,
        })
      ),
    };

    await expect(
      processClaimedAsaasWebhookEvent({
        event: claimedEvent,
        pool: {
          connect: vi.fn().mockResolvedValue(client),
          query: vi.fn(),
        } as never,
        processor,
        workerId: "worker-a",
      })
    ).resolves.toBe("retrying");

    expect(query).toHaveBeenNthCalledWith(3, "rollback");
    expect(String(query.mock.calls[3]?.[0])).toContain("status = 'retryable'");
    expect(query.mock.calls[3]?.[1]).toEqual([
      "event-1",
      "worker-a",
      60_000,
      "order_not_ready",
    ]);
  });

  it("marks the fifth failed attempt terminal instead of retrying", async () => {
    const fifthAttempt = { ...claimedEvent, attemptCount: 5 };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fifthAttempt] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] });

    await expect(
      processClaimedAsaasWebhookEvent({
        event: fifthAttempt,
        pool: {
          connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
          query: vi.fn(),
        } as never,
        processor: {
          prepare: vi.fn(async () => ({ kind: "not_required" as const })),
          process: vi.fn().mockRejectedValue(new Error("contains PII")),
        },
        workerId: "worker-a",
      })
    ).resolves.toBe("failed");

    expect(String(query.mock.calls[3]?.[0])).toContain("status = 'failed'");
    expect(query.mock.calls[3]?.[1]).toEqual([
      "event-1",
      "worker-a",
      "webhook_processing_failed",
    ]);
  });

  it("requeues only a failed unsanitized Asaas event with reason and audit atomically", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await requeueFailedAsaasWebhook({
      actorUserId: "admin-1",
      eventId: "event-1",
      reason: "Falha transitória verificada.",
    });

    const requeueSql = String(query.mock.calls[1]?.[0]);
    expect(requeueSql).toContain("provider = 'asaas'");
    expect(requeueSql).toContain("status = 'failed'");
    expect(requeueSql).toContain("payload_sanitized_at is null");
    expect(requeueSql).toContain("payload_expires_at > now()");
    expect(String(query.mock.calls[2]?.[0])).toContain(
      "'asaas_webhook.requeued'"
    );
    expect(query.mock.calls[2]?.[1]).toEqual([
      "admin-1",
      "event-1",
      "Falha transitória verificada.",
    ]);
    expect(query).toHaveBeenNthCalledWith(4, "commit");
  });
});

describe("Asaas webhook runner", () => {
  it("checks deadline and lease between events and respects its batch bound", async () => {
    const processor = {
      prepare: vi.fn(async () => ({ kind: "not_required" as const })),
      process: vi.fn(),
    };
    const shouldContinue = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const pool = { query: vi.fn() };
    dependencies.getPool.mockReturnValue(pool);
    dependencies.claimAsaasWebhookEvents
      .mockResolvedValueOnce([claimedEvent])
      .mockResolvedValue([]);
    dependencies.processClaimedAsaasWebhookEvent.mockResolvedValue("ignored");
    dependencies.failExhaustedAsaasWebhookEvents.mockResolvedValue(2);

    await expect(
      runAsaasWebhookWorker({
        claim: dependencies.claimAsaasWebhookEvents,
        failExhausted: dependencies.failExhaustedAsaasWebhookEvents,
        limit: 20,
        process: dependencies.processClaimedAsaasWebhookEvent,
        processor,
        shouldContinue,
        workerId: "worker-a",
      })
    ).resolves.toEqual({
      deadlineReached: false,
      failed: 2,
      ignored: 1,
      leaseLost: true,
      processed: 0,
      retried: 0,
    });

    expect(dependencies.claimAsaasWebhookEvents).toHaveBeenCalledOnce();
    expect(dependencies.failExhaustedAsaasWebhookEvents).toHaveBeenCalledWith({
      client: pool,
      limit: 20,
    });
    expect(dependencies.processClaimedAsaasWebhookEvent).toHaveBeenCalledWith({
      event: claimedEvent,
      pool,
      processor,
      workerId: "worker-a",
    });
  });
});
