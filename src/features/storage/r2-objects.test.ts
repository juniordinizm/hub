import { describe, expect, it } from "vitest";
import {
  buildLessonResourceObjectKey,
  buildLessonResourcePreviewObjectKey,
  validateLessonAttachmentUpload,
  validateLessonImagePreviewUpload,
} from "./r2-objects";

describe("R2 lesson objects", () => {
  it("builds scoped object keys with normalized file names", () => {
    expect(
      buildLessonResourceObjectKey({
        fileName: " Apostila Final 01.pdf ",
        lessonId: "lesson-1",
        nonce: "upload-1",
      })
    ).toBe("lessons/lesson-1/resources/upload-1-apostila-final-01.pdf");
    expect(
      buildLessonResourcePreviewObjectKey({
        lessonId: "lesson-1",
        nonce: "upload-1",
      })
    ).toBe("lessons/lesson-1/resources/upload-1-preview.webp");
  });

  it("accepts common course materials up to the per-file limit", () => {
    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/pdf",
        fileName: "apostila.pdf",
        sizeBytes: 150 * 1024 * 1024,
      })
    ).not.toThrow();
  });

  it("rejects unsafe file types and mismatched extensions before signing", () => {
    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/x-msdownload",
        fileName: "setup.exe",
        sizeBytes: 1024,
      })
    ).toThrow("Extensao de arquivo nao permitida.");

    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/x-msdownload",
        fileName: "apostila.pdf",
        sizeBytes: 1024,
      })
    ).toThrow("Extensao e tipo do arquivo nao correspondem.");

    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/pdf",
        fileName: "apostila.jpg",
        sizeBytes: 1024,
      })
    ).toThrow("Extensao e tipo do arquivo nao correspondem.");
  });

  it("rejects files above the per-file upload limit", () => {
    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/pdf",
        fileName: "apostila.pdf",
        sizeBytes: 151 * 1024 * 1024,
      })
    ).toThrow("Arquivo maior que 150 MB.");
  });

  it("validates generated image previews before signing uploads", () => {
    expect(() =>
      validateLessonImagePreviewUpload({
        contentType: "image/webp",
        height: 180,
        sizeBytes: 24 * 1024,
        width: 320,
      })
    ).not.toThrow();

    expect(() =>
      validateLessonImagePreviewUpload({
        contentType: "image/png",
        height: 180,
        sizeBytes: 24 * 1024,
        width: 320,
      })
    ).toThrow("Tipo de preview invalido.");
  });
});
