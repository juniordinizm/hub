import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { applyPaymentRevocation } from "./server";

describe("payment revocation", () => {
  it("atomically leaves a terminal paid grant unchanged without events or projection", async () => {
    const query = vi.fn((text: string) => {
      if (text.includes("update enrollment_grants")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.reject(
        new Error(`Unexpected query after revocation no-op: ${text}`)
      );
    });
    const client = { query } as unknown as PoolClient;

    await expect(
      applyPaymentRevocation({
        client,
        courseId: "course-1",
        now: new Date("2026-07-29T12:00:00.000Z"),
        orderId: "11111111-1111-4111-8111-111111111111",
        reason: "payment_refund",
        userId: "user-1",
      })
    ).resolves.toBe(false);

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain(
      "and status in ('active', 'expired')"
    );
  });
});
