import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { twoFactors, users } from "./schema";

const TWO_FACTOR_SEED_PATTERN = /insert\s+into\s+two_factors/i;

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name);

const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((tableIndex) => tableIndex.config.name);

describe("Better Auth two-factor persistence contract", () => {
  it("matches the Better Auth 1.6.25 two-factor model without extra data", () => {
    expect(users.twoFactorEnabled.name).toBe("two_factor_enabled");
    expect(users.twoFactorEnabled.notNull).toBe(true);
    expect(users.twoFactorEnabled.default).toBe(false);

    expect(getTableConfig(twoFactors).name).toBe("two_factors");
    expect(columnNames(twoFactors)).toEqual([
      "id",
      "secret",
      "backup_codes",
      "user_id",
      "verified",
      "failed_verification_count",
      "locked_until",
    ]);
    expect(twoFactors.userId.isUnique).toBe(true);
    expect(twoFactors.verified.default).toBe(true);
    expect(twoFactors.failedVerificationCount.default).toBe(0);
    expect(indexNames(twoFactors)).toContain("two_factors_secret_idx");
  });

  it("revokes sessions when a role or two-factor state changes", async () => {
    const migration = await readFile(
      new URL("./migrations/0065_gray_siren.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("AFTER UPDATE OF role ON profiles");
    expect(migration).toContain("AFTER UPDATE OF two_factor_enabled ON users");
    expect(
      migration.match(/DELETE FROM sessions WHERE user_id = NEW\./g)
    ).toHaveLength(2);
    expect(migration).not.toMatch(TWO_FACTOR_SEED_PATTERN);
  });
});
