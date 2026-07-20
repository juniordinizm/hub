import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("student lesson video processing state", () => {
  it("shows an explicit JMVStream processing placeholder when a hash exists without a player", async () => {
    const [source, processingSource] = await Promise.all([
      readFile(new URL("./page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../../../../components/lesson-video-processing.tsx",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

    expect(source).toContain("videoProcessing");
    expect(source).toContain("data.lesson.videoExternalId");
    expect(processingSource).toContain("Processando vídeo");
  });
});
