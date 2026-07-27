import { describe, expect, it, vi } from "vitest";
import { runMigrationWithLock } from "./migration-lock";

describe("runMigrationWithLock", () => {
  it("holds a database-wide lock for the complete migration", async () => {
    const events: string[] = [];
    const client = {
      query: vi.fn((statement: string) => {
        events.push(statement);
        return Promise.resolve(
          statement.includes("pg_try_advisory_lock")
            ? { rows: [{ acquired: true }] }
            : undefined
        );
      }),
      release: vi.fn(() => {
        events.push("release");
      }),
    };

    await runMigrationWithLock({
      client,
      migrate: () => {
        events.push("migrate");
        return Promise.resolve();
      },
    });

    expect(events).toEqual([
      "select pg_try_advisory_lock($1) as acquired",
      "migrate",
      "select pg_advisory_unlock($1)",
      "release",
    ]);
  });

  it("unlocks after a migration failure", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ acquired: true }] })
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };

    await expect(
      runMigrationWithLock({
        client,
        migrate: () => Promise.reject(new Error("migration failed")),
      })
    ).rejects.toThrow("migration failed");

    expect(client.query).toHaveBeenLastCalledWith(
      "select pg_advisory_unlock($1)",
      expect.any(Array)
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("releases the client when unlocking fails", async () => {
    const release = vi.fn();
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ acquired: true }] })
        .mockRejectedValueOnce(new Error("unlock failed")),
      release,
    };

    await expect(
      runMigrationWithLock({
        client,
        migrate: () => Promise.resolve(),
      })
    ).rejects.toThrow("unlock failed");

    expect(release).toHaveBeenCalledOnce();
  });

  it("fails fast when another database migration owns the lock", async () => {
    const migrate = vi.fn(async () => undefined);
    const release = vi.fn();
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
      release,
    };

    await expect(
      runMigrationWithLock({
        client,
        migrate,
      })
    ).rejects.toThrow("Another database migration is already running.");

    expect(migrate).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});
