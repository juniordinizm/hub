import { describe, expect, it } from "vitest";
import {
  buildCourseCoverObjectKey,
  COURSE_COVER_ASPECT_RATIO,
  COURSE_COVER_CARD_HEIGHT,
  COURSE_COVER_CARD_WIDTH,
  getCourseCoverStorageKeys,
  getCourseCoverVariantPath,
  parseCourseCoverImage,
  validateCourseCoverUploadRequest,
} from "./course-cover";

describe("course cover storage", () => {
  it("defines the card crop as 960x1000 at 24:25", () => {
    expect(COURSE_COVER_CARD_WIDTH).toBe(960);
    expect(COURSE_COVER_CARD_HEIGHT).toBe(1000);
    expect(COURSE_COVER_ASPECT_RATIO).toBe(24 / 25);
  });

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
    ).toThrow("Envie as variantes thumb e card da capa.");
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
            height: 1000,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
          thumb: {
            contentType: "image/webp",
            height: 500,
            key: "courses/course-1/cover/upload-thumb.webp",
            sizeBytes: 120_000,
            width: 480,
          },
        },
      })
    ).toEqual({
      blurDataUrl: undefined,
      original: {
        contentType: "image/png",
        fileName: "capa.png",
        key: "courses/course-1/cover/upload-original.png",
        sizeBytes: 1_000_000,
      },
      variants: {
        card: {
          contentType: "image/webp",
          height: 1000,
          key: "courses/course-1/cover/upload-card.webp",
          sizeBytes: 500_000,
          width: 960,
        },
        thumb: {
          contentType: "image/webp",
          height: 500,
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
              height: 1000,
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

  it("extracts all R2 keys from stored cover metadata, including old variants", () => {
    expect(
      getCourseCoverStorageKeys({
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 1000,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
          hero: {
            contentType: "image/webp",
            height: 900,
            key: "courses/course-1/cover/upload-hero.webp",
            sizeBytes: 900_000,
            width: 1600,
          },
          thumb: {
            contentType: "image/webp",
            height: 500,
            key: "courses/course-1/cover/upload-thumb.webp",
            sizeBytes: 120_000,
            width: 480,
          },
        },
      })
    ).toEqual([
      "courses/course-1/cover/upload-original.png",
      "courses/course-1/cover/upload-card.webp",
      "courses/course-1/cover/upload-hero.webp",
      "courses/course-1/cover/upload-thumb.webp",
    ]);
  });
});
