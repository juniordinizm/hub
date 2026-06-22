import { describe, expect, it } from "vitest";
import {
  getLessonContentReadiness,
  getLessonContentStorageKeys,
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

  it("stores R2 lesson attachments as private resources scoped to the lesson", () => {
    const formData = new FormData();
    formData.set("textDocument", JSON.stringify(richTextDocument));
    formData.set("resourceStorage[]", "r2");
    formData.set("resourceLabel[]", "Apostila");
    formData.set(
      "resourceKey[]",
      "lessons/lesson-1/resources/upload-1-apostila.pdf"
    );
    formData.set("resourceFileName[]", "apostila.pdf");
    formData.set("resourceContentType[]", "application/pdf");
    formData.set(
      "resourcePreview[]",
      JSON.stringify({
        contentType: "image/webp",
        height: 180,
        key: "lessons/lesson-1/resources/upload-1-preview.webp",
        sizeBytes: 4096,
        width: 320,
      })
    );
    formData.set("resourceSizeBytes[]", "1024");

    expect(
      normalizeLessonContentFromForm({
        formData,
        lessonId: "lesson-1",
        lessonType: "text",
      })
    ).toEqual({
      type: "text",
      document: richTextDocument,
      resources: [
        {
          contentType: "application/pdf",
          fileName: "apostila.pdf",
          id: "resource-1",
          key: "lessons/lesson-1/resources/upload-1-apostila.pdf",
          label: "Apostila",
          preview: {
            contentType: "image/webp",
            height: 180,
            key: "lessons/lesson-1/resources/upload-1-preview.webp",
            sizeBytes: 4096,
            width: 320,
          },
          sizeBytes: 1024,
          storage: "r2",
        },
      ],
    });
  });

  it("reads stored R2 lesson attachments", () => {
    expect(
      parseLessonContent({
        type: "text",
        document: richTextDocument,
        resources: [
          {
            contentType: "application/pdf",
            fileName: "apostila.pdf",
            id: "resource-1",
            key: "lessons/lesson-1/resources/upload-1-apostila.pdf",
            label: "Apostila",
            preview: {
              contentType: "image/webp",
              height: 180,
              key: "lessons/lesson-1/resources/upload-1-preview.webp",
              sizeBytes: 4096,
              width: 320,
            },
            sizeBytes: 1024,
            storage: "r2",
          },
        ],
      })
    ).toEqual({
      type: "text",
      document: richTextDocument,
      resources: [
        {
          contentType: "application/pdf",
          fileName: "apostila.pdf",
          id: "resource-1",
          key: "lessons/lesson-1/resources/upload-1-apostila.pdf",
          label: "Apostila",
          preview: {
            contentType: "image/webp",
            height: 180,
            key: "lessons/lesson-1/resources/upload-1-preview.webp",
            sizeBytes: 4096,
            width: 320,
          },
          sizeBytes: 1024,
          storage: "r2",
        },
      ],
    });
  });

  it("extracts private R2 resource keys from lesson content", () => {
    expect(
      getLessonContentStorageKeys({
        type: "text",
        document: richTextDocument,
        resources: [
          {
            contentType: "application/pdf",
            fileName: "apostila.pdf",
            id: "resource-1",
            key: "lessons/lesson-1/resources/upload-1-apostila.pdf",
            label: "Apostila",
            preview: {
              contentType: "image/webp",
              height: 180,
              key: "lessons/lesson-1/resources/upload-1-preview.webp",
              sizeBytes: 4096,
              width: 320,
            },
            sizeBytes: 1024,
            storage: "r2",
          },
          {
            id: "resource-2",
            label: "Link externo",
            url: "https://example.com/material",
          },
        ],
      })
    ).toEqual([
      "lessons/lesson-1/resources/upload-1-apostila.pdf",
      "lessons/lesson-1/resources/upload-1-preview.webp",
    ]);
  });

  it("limits lesson resources to a reasonable count and total R2 size", () => {
    const tooManyResources = new FormData();
    tooManyResources.set("textDocument", JSON.stringify(richTextDocument));

    for (let index = 0; index < 16; index += 1) {
      tooManyResources.append("resourceLabel[]", `Material ${index + 1}`);
      tooManyResources.append(
        "resourceUrl[]",
        `https://example.com/material-${index + 1}.pdf`
      );
    }

    expect(() =>
      normalizeLessonContentFromForm({
        formData: tooManyResources,
        lessonId: "lesson-1",
        lessonType: "text",
      })
    ).toThrow("Limite de 15 materiais por aula atingido.");

    const tooLargeTotal = new FormData();
    tooLargeTotal.set("textDocument", JSON.stringify(richTextDocument));
    tooLargeTotal.set("resourceStorage[]", "r2");
    tooLargeTotal.set("resourceLabel[]", "Pacote 1");
    tooLargeTotal.set(
      "resourceKey[]",
      "lessons/lesson-1/resources/upload-1.zip"
    );
    tooLargeTotal.set("resourceFileName[]", "upload-1.zip");
    tooLargeTotal.set("resourceContentType[]", "application/zip");
    tooLargeTotal.set("resourceSizeBytes[]", String(751 * 1024 * 1024));

    expect(() =>
      normalizeLessonContentFromForm({
        formData: tooLargeTotal,
        lessonId: "lesson-1",
        lessonType: "text",
      })
    ).toThrow("Limite de 750 MB em materiais da aula atingido.");
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

    const invalidR2Key = new FormData();
    invalidR2Key.set("textDocument", JSON.stringify(richTextDocument));
    invalidR2Key.set("resourceStorage[]", "r2");
    invalidR2Key.set("resourceKey[]", "lessons/other/resources/file.pdf");
    invalidR2Key.set("resourceFileName[]", "file.pdf");
    invalidR2Key.set("resourceContentType[]", "application/pdf");
    invalidR2Key.set("resourceSizeBytes[]", "100");

    expect(() =>
      normalizeLessonContentFromForm({
        formData: invalidR2Key,
        lessonId: "lesson-1",
        lessonType: "text",
      })
    ).toThrow("O arquivo enviado nao pertence a esta aula.");
  });

  it("rejects removed non-video/text lesson content types", () => {
    expect(
      parseLessonContent({
        type: "file",
        url: "https://example.com/slides.pdf",
      })
    ).toBeNull();

    expect(
      parseLessonContent({
        type: "download",
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
          type: "download",
          body: "Material que nao deve mais contar como aula",
        },
        lessonType: "download",
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProvider: null,
      })
    ).toEqual({ isReady: false, missingLabel: "Adicionar video" });
  });
});
