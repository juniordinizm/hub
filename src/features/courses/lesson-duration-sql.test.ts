import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson duration persistence", () => {
  it("adds separate video and text duration fields to lessons", async () => {
    const migration = await readFile(
      new URL(
        "../../db/migrations/0021_lesson_duration_breakdown.sql",
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

  it("saves lesson duration as video plus estimated text reading time", async () => {
    const source = await readFile(
      new URL("../admin/actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("calculateLessonDurationBreakdown");
    expect(source).toContain("video_duration_seconds");
    expect(source).toContain("text_duration_seconds");
    expect(source).toContain("text_word_count");
    expect(source).toContain("durationBreakdown.totalDurationSeconds");
  });

  it("keeps text duration when JMVStream later syncs video duration", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("video_duration_seconds = $1");
    expect(source).toContain(
      "duration_seconds = $1 + coalesce(text_duration_seconds, 0)"
    );
  });
});
