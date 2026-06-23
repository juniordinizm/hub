import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson comments section moderation UI", () => {
  it("offers restore controls for hidden comments and keeps the hidden notice moderation-only", async () => {
    const source = await readFile(
      new URL("./lesson-comments-section.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("restoreLessonCommentAction");
    expect(source).toContain("Desocultar");
    expect(source).toContain("Comentario ocultado da area do aluno.");
  });
});
