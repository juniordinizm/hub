import { describe, expect, it } from "vitest";
import {
  buildLessonResourceObjectKey,
  validateLessonAttachmentUpload,
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
  });

  it("validates lesson attachment uploads before signing", () => {
    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/pdf",
        fileName: "apostila.pdf",
        sizeBytes: 1024,
      })
    ).not.toThrow();

    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/x-msdownload",
        fileName: "setup.exe",
        sizeBytes: 1024,
      })
    ).toThrow("Tipo de arquivo nao permitido.");

    expect(() =>
      validateLessonAttachmentUpload({
        contentType: "application/pdf",
        fileName: "apostila.pdf",
        sizeBytes: 60 * 1024 * 1024,
      })
    ).toThrow("Arquivo maior que 50 MB.");
  });
});
