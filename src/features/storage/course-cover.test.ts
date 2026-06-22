import { describe, expect, it } from "vitest";
import {
  buildCourseCoverObjectKey,
  getCourseCoverVariantPath,
  parseCourseCoverImage,
  validateCourseCoverUploadRequest,
} from "./course-cover";

describe("course cover storage", () => {
  it("builds scoped R2 object keys for cover variants", () => {
    expect(
      buildCourseCoverObjectKey({
        courseId: "course-1",
        extension: "webp",
        nonce: "upload-1",
        variant: "card",
      })
    ).toBe("courses/course-1/cover/upload-1-card.webp");
  });

  it("validates generated variants before signing uploads", () => {
    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          sizeBytes: 4 * 1024 * 1024,
        },
        variants: [
          {
            contentType: "image/webp",
            sizeBytes: 220 * 1024,
            variant: "thumb",
          },
          {
            contentType: "image/webp",
            sizeBytes: 700 * 1024,
            variant: "card",
          },
          {
            contentType: "image/webp",
            sizeBytes: 1600 * 1024,
            variant: "hero",
          },
        ],
      })
    ).not.toThrow();
  });

  it("rejects unsafe cover images and missing variants", () => {
    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        original: {
          contentType: "image/svg+xml",
          fileName: "capa.png",
          sizeBytes: 1024,
        },
        variants: [],
      })
    ).toThrow("Tipo de imagem nao permitido.");

    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        original: {
          contentType: "image/png",
          fileName: "capa.svg",
          sizeBytes: 1024,
        },
        variants: [],
      })
    ).toThrow("Extensao de imagem nao permitida.");

    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        original: {
          contentType: "image/jpeg",
          fileName: "capa.jpg",
          sizeBytes: 2 * 1024 * 1024,
        },
        variants: [
          {
            contentType: "image/webp",
            sizeBytes: 100 * 1024,
            variant: "thumb",
          },
        ],
      })
    ).toThrow("Envie as variantes thumb, card e hero da capa.");
  });

  it("parses stored cover metadata and ignores invalid variants", () => {
    expect(
      parseCourseCoverImage({
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 540,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
          thumb: {
            contentType: "image/webp",
            height: 270,
            key: "courses/course-1/cover/upload-thumb.webp",
            sizeBytes: 120_000,
            width: 480,
          },
        },
      })
    ).toEqual({
      original: {
        contentType: "image/png",
        fileName: "capa.png",
        key: "courses/course-1/cover/upload-original.png",
        sizeBytes: 1_000_000,
      },
      variants: {
        card: {
          contentType: "image/webp",
          height: 540,
          key: "courses/course-1/cover/upload-card.webp",
          sizeBytes: 500_000,
          width: 960,
        },
        thumb: {
          contentType: "image/webp",
          height: 270,
          key: "courses/course-1/cover/upload-thumb.webp",
          sizeBytes: 120_000,
          width: 480,
        },
      },
    });
  });

  it("builds public course cover paths only for stored variants", () => {
    expect(
      getCourseCoverVariantPath({
        courseId: "course-1",
        coverImage: {
          original: {
            contentType: "image/png",
            fileName: "capa.png",
            key: "courses/course-1/cover/upload-original.png",
            sizeBytes: 1_000_000,
          },
          variants: {
            card: {
              contentType: "image/webp",
              height: 540,
              key: "courses/course-1/cover/upload-card.webp",
              sizeBytes: 500_000,
              width: 960,
            },
          },
        },
        variant: "card",
      })
    ).toBe("/api/courses/course-1/cover/card");

    expect(
      getCourseCoverVariantPath({
        courseId: "course-1",
        coverImage: null,
        variant: "card",
      })
    ).toBeNull();
  });
});
