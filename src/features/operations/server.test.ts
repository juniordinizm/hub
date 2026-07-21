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
            videos_pending: "4",
            webhooks_failed: "5",
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
      webhooks: {
        failed: 5,
        oldestFailedAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    });
  });
});
