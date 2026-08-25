import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enqueueOutboxMessage: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));

import { processEnrollmentMaintenance } from "./maintenance";

describe("enrollment expiry warning generation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("binds the outbox v2 generation to the exact expiration read by maintenance", async () => {
    const now = new Date("2026-08-25T10:00:00.000Z");
    const expiresAt = new Date("2026-08-31T10:00:00.000Z");
    const client = {
      query: vi.fn((sql: string) => {
        if (sql.includes("update enrollments")) {
          return Promise.resolve({ rows: [{ id: "enrollment-1" }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const query = vi.fn((sql: string) => {
      if (sql.includes("from enrollments e")) {
        return Promise.resolve({
          rows: [
            {
              expires_at: expiresAt,
              expiry_warning_1d_sent_at: null,
              expiry_warning_7d_sent_at: null,
              id: "enrollment-1",
              status: "active",
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query,
    });
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-1",
      inserted: true,
    });

    await expect(processEnrollmentMaintenance({ now })).resolves.toMatchObject({
      warning7dCount: 1,
      warningFailureCount: 0,
    });
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: {
        aggregateId: "enrollment-1",
        aggregateType: "enrollment",
        idempotencyKey:
          "email.access-expiry-warning/enrollment-1/7d/1788170400000/v2",
        payload: {
          enrollmentId: "enrollment-1",
          expectedExpiresAt: "2026-08-31T10:00:00.000Z",
          warningKind: "7d",
        },
        payloadVersion: 2,
        topic: "email.access-expiry-warning",
      },
    });
  });
});
