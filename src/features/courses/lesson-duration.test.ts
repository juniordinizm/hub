import { describe, expect, it } from "vitest";
import type { ProseMirrorJson } from "./lesson-content";
import {
  calculateLessonDurationBreakdown,
  countTextWords,
  estimateReadingDurationSeconds,
} from "./lesson-duration";

const document: ProseMirrorJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Introducao ao modulo" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Leia este conteudo com atencao." },
        { type: "hardBreak" },
        { type: "text", text: "Depois revise os principais conceitos." },
      ],
    },
  ],
};

describe("lesson duration estimation", () => {
  it("counts words from a Tiptap JSON document", () => {
    expect(countTextWords(document)).toBe(13);
  });

  it("estimates reading duration at 260 words per minute rounded up to minutes", () => {
    expect(estimateReadingDurationSeconds(0)).toBe(0);
    expect(estimateReadingDurationSeconds(1)).toBe(60);
    expect(estimateReadingDurationSeconds(260)).toBe(60);
    expect(estimateReadingDurationSeconds(261)).toBe(120);
  });

  it("sums video duration and estimated text duration into the lesson total", () => {
    expect(
      calculateLessonDurationBreakdown({
        textDocument: document,
        videoDurationSeconds: 125,
      })
    ).toEqual({
      textDurationSeconds: 60,
      textWordCount: 13,
      totalDurationSeconds: 185,
      videoDurationSeconds: 125,
    });
  });
});
