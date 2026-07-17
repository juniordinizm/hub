import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("student video duration authority", () => {
  it("does not expose editorial duration synchronization to students", async () => {
    const actions = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );
    const player = await readFile(
      new URL("../../../components/lesson-video-player.tsx", import.meta.url),
      "utf8"
    );

    expect(actions).not.toContain("syncJmvstreamLessonDuration");
    expect(player).not.toContain("syncJmvstreamLessonDurationAction");
  });
});
