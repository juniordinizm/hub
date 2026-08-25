import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(import.meta.dirname, "migrations");
const UPDATE_PATTERN = /\bupdate\b/i;

describe("0066 superseded outbox schema", () => {
  it("adds the enum value, timestamp and non-partial index without data updates", async () => {
    const sql = await readFile(
      join(migrationsDirectory, "0066_gifted_retro_girl.sql"),
      "utf8"
    );
    expect(sql).toContain("ADD VALUE 'superseded'");
    expect(sql).toContain('ADD COLUMN "superseded_at"');
    expect(sql).toContain('CREATE INDEX "outbox_messages_superseded_idx"');
    expect(sql).not.toContain("WHERE");
    expect(sql).not.toMatch(UPDATE_PATTERN);
  });

  it("keeps schema and snapshot aligned with the terminal state", async () => {
    const snapshot = JSON.parse(
      await readFile(
        join(migrationsDirectory, "meta/0066_snapshot.json"),
        "utf8"
      )
    ) as {
      enums?: Record<string, { values?: string[] }>;
      tables?: Record<
        string,
        {
          columns?: Record<string, unknown>;
          indexes?: Record<string, { where?: string }>;
        }
      >;
    };
    expect(snapshot.enums?.["public.outbox_status"]?.values).toContain(
      "superseded"
    );
    expect(
      snapshot.tables?.["public.outbox_messages"]?.columns?.superseded_at
    ).toBeDefined();
    expect(
      snapshot.tables?.["public.outbox_messages"]?.indexes
        ?.outbox_messages_superseded_idx?.where
    ).toBeUndefined();
  });
});
