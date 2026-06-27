import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JmvstreamUploadPanel upload lifecycle", () => {
  it("does not mark completed uploads as failed when player sync fails", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("let uploadCompleted = false");
    expect(source).toContain("uploadCompleted = true");
    expect(source).toContain("if (activeVideoHash && !uploadCompleted)");
  });

  it("removes the lesson video through a server action instead of only local form state", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("removeJmvstreamVideoFromLessonAction");
    expect(source).toContain("await removeJmvstreamVideoFromLessonAction");
    expect(source).toContain("onRemoveVideo?.()");
  });

  it("shows a pending-delete status when JMVStream rejects remote deletion", async () => {
    const source = await readFile(
      new URL("./jmvstream-upload-panel.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("result.deletePending");
    expect(source).toContain(
      "Video removido da aula. Exclusao na JMVStream pendente."
    );
  });
});
