import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("student course server SQL", () => {
  it("lazily syncs JMVStream player URLs before rendering lessons", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("resolveStudentLessonVideoEmbedUrl");
    expect(source).toContain("syncJmvstreamLessonPlayer");
    expect(source).toContain("video_external_id");
  });
});
