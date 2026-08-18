import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { certificates, courseCompletions } from "./schema";

const DATA_REWRITE_PATTERN = /\b(delete|insert|truncate|update)\b/i;

const getIndex = (table: Parameters<typeof getTableConfig>[0], name: string) =>
  getTableConfig(table).indexes.find(
    (tableIndex) => tableIndex.config.name === name
  );

const getIndexColumnNames = (
  index: ReturnType<typeof getIndex>
): Array<string | undefined> =>
  index?.config.columns.map((column) =>
    "name" in column && typeof column.name === "string"
      ? column.name
      : undefined
  ) ?? [];

describe("certificate reconciliation persistence contract", () => {
  it("indexes the stable completion batch by course and ordering columns", () => {
    const reconciliationIndex = getIndex(
      courseCompletions,
      "course_completions_course_reconciliation_idx"
    );

    expect(getIndexColumnNames(reconciliationIndex)).toEqual([
      "course_id",
      "completed_at",
      "id",
      "user_id",
    ]);
  });

  it("indexes all certificate history without a status predicate", () => {
    const historyIndex = getIndex(
      certificates,
      "certificates_user_course_history_idx"
    );

    expect(getIndexColumnNames(historyIndex)).toEqual(["user_id", "course_id"]);
    expect(historyIndex?.config.where).toBeUndefined();
  });

  it("adds both indexes without rewriting certificate data", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0062_certificate_reconciliation_indexes.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      'CREATE INDEX "certificates_user_course_history_idx" ON "certificates" USING btree ("user_id","course_id")'
    );
    expect(migration).toContain(
      'CREATE INDEX "course_completions_course_reconciliation_idx" ON "course_completions" USING btree ("course_id","completed_at","id","user_id")'
    );
    expect(migration).not.toMatch(DATA_REWRITE_PATTERN);
  });
});
