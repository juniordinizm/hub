import { describe, expect, it, vi } from "vitest";
import { runWithAdvisoryLock } from "./advisory-lock";

describe("runWithAdvisoryLock", () => {
  it("skips execution when another worker owns the lock", async () => {
    const execute = vi.fn();
    const release = vi.fn();

    await expect(
      runWithAdvisoryLock({
        connect: async () => ({
          query: vi.fn(async () => ({ rows: [{ acquired: false }] })),
          release,
        }),
        execute,
        lockId: 2_040_701,
      })
    ).resolves.toEqual({ acquired: false });

    expect(execute).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("always unlocks and releases after execution", async () => {
    const queries: string[] = [];
    const release = vi.fn();

    await expect(
      runWithAdvisoryLock({
        connect: async () => ({
          query: vi.fn((statement: string) => {
            queries.push(statement);
            return Promise.resolve({ rows: [{ acquired: true }] });
          }),
          release,
        }),
        execute: async () => "complete",
        lockId: 2_040_701,
      })
    ).resolves.toEqual({ acquired: true, value: "complete" });

    expect(queries).toEqual([
      "select pg_try_advisory_lock($1) as acquired",
      "select pg_advisory_unlock($1)",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("releases the client when unlocking fails", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockRejectedValueOnce(new Error("unlock failed"));

    await expect(
      runWithAdvisoryLock({
        connect: () => Promise.resolve({ query, release }),
        execute: () => Promise.resolve("complete"),
        lockId: 2_040_701,
      })
    ).rejects.toThrow("unlock failed");

    expect(release).toHaveBeenCalledOnce();
  });
});
