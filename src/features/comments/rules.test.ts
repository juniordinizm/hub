import { describe, expect, it } from "vitest";
import {
  buildLessonCommentTree,
  COMMENT_BODY_MAX_LENGTH,
  normalizeCommentBody,
  sanitizeLessonComment,
  validateReplyTarget,
} from "./rules";

const visibleRoot = {
  id: "root-1",
  lessonId: "lesson-1",
  parentId: null,
  body: "Pergunta principal",
  status: "visible" as const,
  author: {
    id: "student-1",
    name: "Ana",
    role: "student" as const,
  },
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-01T10:00:00.000Z"),
};

describe("lesson comment rules", () => {
  it("trims body text and rejects empty comments", () => {
    expect(normalizeCommentBody("  Minha duvida  ")).toBe("Minha duvida");
    expect(() => normalizeCommentBody("   ")).toThrow(
      "Escreva um comentario antes de enviar."
    );
  });

  it("rejects comments over the maximum length", () => {
    expect(() =>
      normalizeCommentBody("a".repeat(COMMENT_BODY_MAX_LENGTH + 1))
    ).toThrow(
      `O comentario deve ter ate ${COMMENT_BODY_MAX_LENGTH} caracteres.`
    );
  });

  it("rejects reply targets from another lesson or nested below another reply", () => {
    expect(() =>
      validateReplyTarget({
        lessonId: "lesson-1",
        parent: { id: "root-2", lessonId: "lesson-2", parentId: null },
      })
    ).toThrow("Comentario de origem invalido.");

    expect(() =>
      validateReplyTarget({
        lessonId: "lesson-1",
        parent: { id: "reply-1", lessonId: "lesson-1", parentId: "root-1" },
      })
    ).toThrow("Responda apenas comentarios principais.");
  });

  it("keeps hidden comment text out of the presentation model", () => {
    expect(
      sanitizeLessonComment({
        ...visibleRoot,
        body: "Texto sensivel",
        status: "hidden",
      })
    ).toMatchObject({
      body: null,
      isHidden: true,
    });
  });

  it("builds a stable one-level tree ordered by creation date", () => {
    const comments = buildLessonCommentTree([
      {
        ...visibleRoot,
        id: "reply-2",
        parentId: "root-1",
        body: "Segunda resposta",
        createdAt: new Date("2026-01-01T10:03:00.000Z"),
      },
      {
        ...visibleRoot,
        id: "root-2",
        parentId: null,
        body: "Outra pergunta",
        createdAt: new Date("2026-01-01T10:02:00.000Z"),
      },
      {
        ...visibleRoot,
        id: "reply-1",
        parentId: "root-1",
        body: "Primeira resposta",
        createdAt: new Date("2026-01-01T10:01:00.000Z"),
      },
      visibleRoot,
    ]);

    expect(comments.map((comment) => comment.id)).toEqual(["root-1", "root-2"]);
    expect(comments[0]?.replies.map((reply) => reply.id)).toEqual([
      "reply-1",
      "reply-2",
    ]);
  });
});
