import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect, query: dependencies.query }),
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import { createSupportRequest } from "./server";

const createClient = () => {
  const query = vi.fn((sql: string) => {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.startsWith("insert into support_requests")) {
      return { rows: [{ id: "request-1" }] };
    }
    return { rows: [] };
  });
  return { query, release: vi.fn() };
};

describe("createSupportRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.query.mockResolvedValue({ rows: [{ count: "0" }] });
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-1",
      inserted: true,
    });
  });

  it("stores the request and enqueues the notification in one transaction", async () => {
    const client = createClient();
    dependencies.connect.mockResolvedValue(client);

    await createSupportRequest({
      courseTitle: "Curso de suporte",
      message: "Mensagem de teste controlada.",
      subject: "Dúvida controlada",
      userId: "student-1",
    });

    expect(dependencies.query).toHaveBeenCalledWith(
      expect.stringContaining("select count(*) as count"),
      ["student-1"]
    );
    expect(client.query).toHaveBeenCalledWith("begin");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("insert into support_requests"),
      [
        "student-1",
        "Dúvida controlada",
        "Mensagem de teste controlada.",
        "Curso de suporte",
      ]
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: {
        aggregateId: "request-1",
        aggregateType: "support_request",
        idempotencyKey: "email.support-request/request-1/v1",
        payload: { requestId: "request-1" },
        payloadVersion: 1,
        topic: "email.support-request",
      },
    });
    expect(client.query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalled();
  });

  it("rolls back and rethrows when the outbox enqueue fails", async () => {
    const client = createClient();
    dependencies.connect.mockResolvedValue(client);
    dependencies.enqueueOutboxMessage.mockRejectedValue(
      new Error("outbox_unavailable")
    );

    await expect(
      createSupportRequest({
        message: "Mensagem de teste controlada.",
        subject: "Dúvida controlada",
        userId: "student-1",
      })
    ).rejects.toThrow("outbox_unavailable");

    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.query).not.toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalled();
  });

  it("rejects oversized fields before opening a transaction", async () => {
    await expect(
      createSupportRequest({
        message: "a".repeat(1801),
        subject: "Dúvida controlada",
        userId: "student-1",
      })
    ).rejects.toThrow("Campo de suporte excede o tamanho permitido.");

    await expect(
      createSupportRequest({
        message: "Mensagem de teste controlada.",
        subject: "a".repeat(161),
        userId: "student-1",
      })
    ).rejects.toThrow("Campo de suporte excede o tamanho permitido.");

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.connect).not.toHaveBeenCalled();
  });

  it("rejects a student above the per-window request limit", async () => {
    dependencies.query.mockResolvedValue({ rows: [{ count: "3" }] });

    await expect(
      createSupportRequest({
        message: "Mensagem de teste controlada.",
        subject: "Dúvida controlada",
        userId: "student-1",
      })
    ).rejects.toThrow(
      "Aguarde alguns minutos antes de enviar outra mensagem de suporte."
    );

    expect(dependencies.connect).not.toHaveBeenCalled();
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });
});
