import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("server-only", () => ({}));

import { getOperationalBacklogSnapshot } from "./server";

describe("operational backlog snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            dead_letters: "2",
            oldest_outbox_at: new Date("2026-07-20T10:00:00.000Z"),
            oldest_video_at: new Date("2026-07-20T11:00:00.000Z"),
            oldest_webhook_failed_at: new Date("2026-07-20T12:00:00.000Z"),
            oldest_webhook_ready_at: new Date("2026-07-20T12:30:00.000Z"),
            oldest_webhook_retry_at: new Date("2026-07-20T13:00:00.000Z"),
            outbox_ready: "3",
            uncertain_checkouts: "9",
            uncorrelated_orders: "6",
            uncertain_refunds: "7",
            videos_pending: "4",
            webhooks_failed: "5",
            webhooks_ready: "8",
            webhooks_retryable: "3",
          },
        ],
      }),
    });
  });

  it("expõe somente contagens e idade do backlog", async () => {
    await expect(
      getOperationalBacklogSnapshot({
        now: () => new Date("2026-07-21T12:00:00.000Z"),
      })
    ).resolves.toEqual({
      alerts: [
        { code: "outbox_dead_letter", severity: "critical" },
        { code: "outbox_pending_stale", severity: "critical" },
        { code: "webhook_ready_stale", severity: "high" },
        { code: "webhook_retry_stale", severity: "high" },
        { code: "webhook_failed_stale", severity: "high" },
      ],
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
        oldestReadyAt: new Date("2026-07-20T12:30:00.000Z"),
        oldestRetryAt: new Date("2026-07-20T13:00:00.000Z"),
        ready: 8,
        retryable: 3,
      },
    });
  });

  it("alerts whenever the outbox contains a dead letter", async () => {
    const pool = dependencies.getPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ dead_letters: "1", outbox_ready: "0" }],
    });

    const snapshot = await getOperationalBacklogSnapshot();

    expect(snapshot.alerts).toEqual([
      { code: "outbox_dead_letter", severity: "critical" },
    ]);
  });

  it.each([
    [14, []],
    [15, [{ code: "outbox_pending_stale", severity: "warning" }]],
    [59, [{ code: "outbox_pending_stale", severity: "warning" }]],
    [60, [{ code: "outbox_pending_stale", severity: "critical" }]],
  ])("classifies an outbox item pending for %i minutes", async (minutes, alerts) => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const pool = dependencies.getPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          dead_letters: "0",
          oldest_outbox_at: new Date(now.getTime() - minutes * 60 * 1000),
          outbox_ready: "1",
        },
      ],
    });

    const snapshot = await getOperationalBacklogSnapshot({ now: () => now });

    expect(snapshot.alerts).toEqual(alerts);
  });

  it("counts retryable Asaas webhooks separately from the ready backlog", async () => {
    await getOperationalBacklogSnapshot();

    expect(
      dependencies.getPool.mock.results[0]?.value.query
    ).toHaveBeenCalledWith(
      expect.stringContaining("status = 'retryable') as webhooks_retryable")
    );
  });

  it("warns before a pending webhook reaches the 30-day payload retention boundary", async () => {
    const pool = dependencies.getPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          dead_letters: "0",
          oldest_outbox_at: null,
          oldest_video_at: null,
          oldest_webhook_failed_at: null,
          oldest_webhook_ready_at: new Date("2026-06-25T00:00:00.000Z"),
          oldest_webhook_retry_at: null,
          outbox_ready: "0",
          uncertain_checkouts: "0",
          uncertain_refunds: "0",
          uncorrelated_orders: "0",
          videos_pending: "0",
          webhooks_failed: "0",
          webhooks_ready: "1",
          webhooks_retryable: "0",
        },
      ],
    });

    const snapshot = await getOperationalBacklogSnapshot({
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    expect(snapshot.alerts).toContainEqual({
      code: "webhook_payload_retention_risk",
      severity: "critical",
    });
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
