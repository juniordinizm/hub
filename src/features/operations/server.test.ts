import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("server-only", () => ({}));

import { getOperationalBacklogSnapshot } from "./server";

describe("operational backlog snapshot", () => {
  beforeEach(() => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            dead_letters: "2",
            oldest_outbox_at: new Date("2026-07-20T10:00:00.000Z"),
            oldest_video_at: new Date("2026-07-20T11:00:00.000Z"),
            oldest_webhook_at: new Date("2026-07-20T12:00:00.000Z"),
            outbox_ready: "3",
            uncertain_checkouts: "9",
            uncorrelated_orders: "6",
            uncertain_refunds: "7",
            videos_pending: "4",
            webhooks_failed: "5",
            webhooks_ready: "8",
          },
        ],
      }),
    });
  });

  it("expõe somente contagens e idade do backlog", async () => {
    await expect(getOperationalBacklogSnapshot()).resolves.toEqual({
      outbox: {
        deadLetters: 2,
        oldestReadyAt: new Date("2026-07-20T10:00:00.000Z"),
        ready: 3,
      },
      videos: {
        oldestPendingAt: new Date("2026-07-20T11:00:00.000Z"),
        pending: 4,
      },
      payments: {
        uncertainCheckouts: 9,
        uncorrelatedOrders: 6,
        uncertainRefunds: 7,
      },
      webhooks: {
        failed: 5,
        oldestFailedAt: new Date("2026-07-20T12:00:00.000Z"),
        ready: 8,
      },
    });
  });

  it("counts retryable Asaas webhooks in the ready backlog", async () => {
    await getOperationalBacklogSnapshot();

    expect(
      dependencies.getPool.mock.results[0]?.value.query
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        "status in ('received', 'processing', 'retryable')"
      )
    );
  });

  it("counts uncertain Asaas checkout creation in the financial backlog", async () => {
    await getOperationalBacklogSnapshot();

    expect(
      dependencies.getPool.mock.results[0]?.value.query
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        "provider = 'asaas' and checkout_status = 'uncertain'"
      )
    );
  });
});
