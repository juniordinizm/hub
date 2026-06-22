import { describe, expect, it } from "vitest";
import {
  getLessonContentReadiness,
  normalizeLessonContentFromForm,
} from "./lesson-content";

describe("lesson content", () => {
  it("keeps video lessons content-free and ready only when a player exists", () => {
    const content = normalizeLessonContentFromForm({
      formData: new FormData(),
      lessonType: "video",
    });

    expect(content).toBeNull();
    expect(
      getLessonContentReadiness({
        contentJson: content,
        lessonType: "video",
        videoEmbedUrl: "https://player.jmvstream.com/video",
        videoExternalId: "hash",
        videoProvider: "jmvstream",
      })
    ).toEqual({ isReady: true, missingLabel: null });
    expect(
      getLessonContentReadiness({
        contentJson: content,
        lessonType: "video",
        videoEmbedUrl: null,
        videoExternalId: "hash",
        videoProvider: "jmvstream",
      })
    ).toEqual({ isReady: false, missingLabel: "Adicionar video" });
  });

  it("normalizes presentation URLs and rejects invalid URLs", () => {
    const formData = new FormData();
    formData.set("presentationUrl", " HTTPS://example.com/slides.pdf ");

    expect(
      normalizeLessonContentFromForm({
        formData,
        lessonType: "presentation",
      })
    ).toEqual({
      type: "presentation",
      url: "https://example.com/slides.pdf",
    });

    const invalid = new FormData();
    invalid.set("presentationUrl", "javascript:alert(1)");

    expect(() =>
      normalizeLessonContentFromForm({
        formData: invalid,
        lessonType: "presentation",
      })
    ).toThrow("Informe uma URL http ou https valida para a apresentacao.");
  });

  it("requires text content for text and bonus lessons", () => {
    const textForm = new FormData();
    textForm.set("textBody", " Linha 1 \n\n Linha 2 ");

    expect(
      normalizeLessonContentFromForm({
        formData: textForm,
        lessonType: "text",
      })
    ).toEqual({
      type: "text",
      body: "Linha 1\n\nLinha 2",
    });

    const bonusForm = new FormData();
    bonusForm.set("bonusBody", "Material complementar");
    bonusForm.set("bonusUrl", "https://example.com/material");

    expect(
      normalizeLessonContentFromForm({
        formData: bonusForm,
        lessonType: "bonus",
      })
    ).toEqual({
      type: "bonus",
      body: "Material complementar",
      url: "https://example.com/material",
    });

    expect(() =>
      normalizeLessonContentFromForm({
        formData: new FormData(),
        lessonType: "text",
      })
    ).toThrow("Informe o conteudo textual da aula.");
  });
});
