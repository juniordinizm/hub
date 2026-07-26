import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { runWithScheduledJobLease } from "./scheduled-job-lease";

describe("scheduled job lease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips work when an unexpired durable lease already exists", async () => {
    const execute = vi.fn();
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      runWithScheduledJobLease({
        execute,
        deadlineMs: 270_000,
        jobName: "jmvstream",
        leaseMs: 300_000,
        ownerToken: "owner-a",
      })
    ).resolves.toEqual({ acquired: false });

    expect(execute).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "where scheduled_job_leases.locked_until <= now()"
    );
  });

  it("runs without retaining a connection and releases only its own lease", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ owner_token: "owner-a" }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      runWithScheduledJobLease({
        deadlineMs: 270_000,
        execute: async ({ isLeaseOwner }) => {
          await expect(isLeaseOwner()).resolves.toBe(true);
          return "complete";
        },
        jobName: "jmvstream",
        leaseMs: 300_000,
        ownerToken: "owner-a",
      })
    ).resolves.toEqual({ acquired: true, value: "complete" });

    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("owner_token = $2"),
      ["jmvstream", "owner-a"]
    );
  });

  it("releases its lease after a failed execution", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ owner_token: "owner-a" }] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      runWithScheduledJobLease({
        execute: () => Promise.reject(new Error("provider unavailable")),
        deadlineMs: 720_000,
        jobName: "maintenance",
        leaseMs: 900_000,
        ownerToken: "owner-a",
      })
    ).rejects.toThrow("provider unavailable");
    expect(query).toHaveBeenCalledTimes(2);
  });
});
