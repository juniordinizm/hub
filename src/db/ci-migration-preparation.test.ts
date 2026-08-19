import { describe, expect, it, vi } from "vitest";
import {
  assertSafeCiMigrationPreparationEnvironment,
  prepareCiMigrationDatabase,
} from "./ci-migration-preparation";

const CI_DATABASE_URL =
  "postgresql://ci:secret@ep-ci-branch.sa-east-1.aws.neon.tech/neondb";
const PRODUCTION_DATABASE_URL =
  "postgresql://owner:secret@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb";

const safeEnvironment = {
  CI: "true",
  CI_NEON_BRANCH_ID: "br-ci-only",
  DATABASE_URL: CI_DATABASE_URL,
  DATABASE_URL_DIRECT: CI_DATABASE_URL,
};

describe("assertSafeCiMigrationPreparationEnvironment", () => {
  it("accepts only an explicit isolated CI target", () => {
    expect(() =>
      assertSafeCiMigrationPreparationEnvironment(safeEnvironment)
    ).not.toThrow();
  });

  it.each([
    [{ ...safeEnvironment, CI: undefined }, "CI must equal true."],
    [
      { ...safeEnvironment, CI_NEON_BRANCH_ID: undefined },
      "CI_NEON_BRANCH_ID is required.",
    ],
    [
      {
        ...safeEnvironment,
        DATABASE_URL:
          "postgresql://ci:secret@ep-other.sa-east-1.aws.neon.tech/neondb",
      },
      "DATABASE_URL must exactly match DATABASE_URL_DIRECT.",
    ],
    [
      {
        ...safeEnvironment,
        DATABASE_URL: PRODUCTION_DATABASE_URL,
        DATABASE_URL_DIRECT: PRODUCTION_DATABASE_URL,
      },
      "CI migration preparation must not target the Production Neon compute.",
    ],
  ])("rejects an unsafe environment", (environment, expectedMessage) => {
    expect(() =>
      assertSafeCiMigrationPreparationEnvironment(environment)
    ).toThrow(expectedMessage);
  });
});

describe("prepareCiMigrationDatabase", () => {
  it("locks, verifies journal 0043, and truncates inherited orders", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 44, migration_top: "1785037403006" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "prepared",
    });

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "begin",
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.stringContaining("drizzle.__drizzle_migrations"),
      "truncate table public.orders cascade",
      "commit",
    ]);
  });

  it("refuses a database whose migration journal is unknown", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 45, migration_top: "1785037403007" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).rejects.toThrow(
      "CI migration preparation requires a clean journal or journal 0043, 0052, 0053, 0054, or 0062."
    );
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("rollback");
  });

  it("does nothing when the parent branch is already at 0052", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 53, migration_top: "1785424607559" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "not-needed",
    });
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("commit");
  });

  it("does nothing when the parent branch is already at 0053", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 54, migration_top: "1785632318824" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "not-needed",
    });
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("commit");
  });

  it("does nothing when the parent branch is already at 0054", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 55, migration_top: "1785744643480" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "not-needed",
    });
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("commit");
  });

  it("does nothing when the parent branch is already at the current local journal", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 63, migration_top: "1787012301824" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "not-needed",
    });
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("commit");
  });

  it("does nothing for a clean CI parent and lets the job apply the full chain", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ migration_count: 0, migration_top: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(prepareCiMigrationDatabase({ query })).resolves.toEqual({
      status: "not-needed",
    });
    expect(query).not.toHaveBeenCalledWith(
      "truncate table public.orders cascade"
    );
    expect(query).toHaveBeenLastCalledWith("commit");
  });
});
