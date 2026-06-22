import { describe, expect, it } from "vitest";
import {
  getLessonContentReadiness,
  normalizeLessonContentFromForm,
  parseLessonContent,
} from "./lesson-content";

const richTextDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Linha 1" }],
    },
  ],
};

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

  it("stores rich text documents and external lesson resources for text lessons", () => {
    const formData = new FormData();
    formData.set("textDocument", JSON.stringify(richTextDocument));
    formData.set("resourceLabel[]", " Slides em PDF ");
    formData.set("resourceUrl[]", " HTTPS://example.com/slides.pdf ");
    formData.append("resourceLabel[]", "Material vazio");
    formData.append("resourceUrl[]", "");

    expect(
      normalizeLessonContentFromForm({
        formData,
        lessonType: "text",
      })
    ).toEqual({
      type: "text",
      document: richTextDocument,
      resources: [
        {
          id: "resource-1",
          label: "Slides em PDF",
          url: "https://example.com/slides.pdf",
        },
      ],
    });
  });

  it("rejects empty rich text documents and invalid resource URLs", () => {
    const emptyDocument = new FormData();
    emptyDocument.set(
      "textDocument",
      JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })
    );

    expect(() =>
      normalizeLessonContentFromForm({
        formData: emptyDocument,
        lessonType: "text",
      })
    ).toThrow("Informe o conteudo textual da aula.");

    const invalid = new FormData();
    invalid.set("textDocument", JSON.stringify(richTextDocument));
    invalid.set("resourceLabel[]", "Slides");
    invalid.set("resourceUrl[]", "javascript:alert(1)");

    expect(() =>
      normalizeLessonContentFromForm({
        formData: invalid,
        lessonType: "text",
      })
    ).toThrow("Informe uma URL http ou https valida para o material.");
  });

  it("rejects removed legacy lesson content types", () => {
    expect(
      parseLessonContent({
        type: "presentation",
        url: "https://example.com/slides.pdf",
      })
    ).toBeNull();

    expect(
      parseLessonContent({
        type: "bonus",
        body: "Material complementar",
        url: "https://example.com/material",
      })
    ).toBeNull();
  });

  it("marks text lesson content readiness correctly", () => {
    expect(
      getLessonContentReadiness({
        contentJson: { type: "text", document: richTextDocument },
        lessonType: "text",
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProvider: null,
      })
    ).toEqual({ isReady: true, missingLabel: null });

    expect(
      getLessonContentReadiness({
        contentJson: { type: "text", body: "Aula legada" },
        lessonType: "text",
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProvider: null,
      })
    ).toEqual({ isReady: true, missingLabel: null });

    expect(
      getLessonContentReadiness({
        contentJson: {
          type: "bonus",
          body: "Material que nao deve mais contar como aula",
        },
        lessonType: "bonus",
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProvider: null,
      })
    ).toEqual({ isReady: false, missingLabel: "Adicionar video" });
  });
});
