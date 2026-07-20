import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson duration persistence", () => {
  it("adds separate video and text duration fields to lessons", async () => {
    const migration = await readFile(
      new URL(
        "../../db/migrations/0020_reconcile_schema_after_manual_changes.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("video_duration_seconds");
    expect(migration).toContain("text_duration_seconds");
    expect(migration).toContain("text_word_count");
    expect(migration).toContain(
      "duration_seconds = video_duration_seconds + text_duration_seconds"
    );
  });

  it("recalculates existing text durations without minute rounding", async () => {
    const migration = await readFile(
      new URL(
        "../../db/migrations/0020_reconcile_schema_after_manual_changes.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("text_word_count::numeric / 260 * 60");
    expect(migration).toContain("greatest(1, round");
    expect(migration).toContain(
      "duration_seconds = video_duration_seconds + recalculated_lessons.text_duration_seconds"
    );
    expect(migration).toContain("workload_hours");
  });
});
