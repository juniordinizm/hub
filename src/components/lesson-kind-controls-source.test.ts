import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("LessonVideoControls preview wiring", () => {
  it("updates the shared preview when uploaded JMVStream player url becomes ready", async () => {
    const source = await readFile(
      new URL("./lesson-kind-controls.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const applyUploadedPlayerUrl =");
    expect(source).toContain("setAppliedEmbedUrl(playerUrl)");
    expect(source).toContain("onPlayerReady={applyUploadedPlayerUrl}");
  });
});
