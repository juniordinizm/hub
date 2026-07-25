import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LATEST_COMPATIBLE_MIGRATION_TIMESTAMP } from "./migration-state";

describe("migration compatibility marker", () => {
  it("matches the latest committed Drizzle migration", async () => {
    const journal = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, "migrations/meta/_journal.json"),
        "utf8"
      )
    ) as { entries: Array<{ when: number }> };

    expect(LATEST_COMPATIBLE_MIGRATION_TIMESTAMP).toBe(
      journal.entries.at(-1)?.when
    );
  });
});
