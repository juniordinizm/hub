import { describe, expect, it } from "vitest";
import { buildPublicMediaUrl } from "./public-media";

describe("public media URLs", () => {
  it("validates the logical key while exposing its physical namespace", () => {
    expect(
      buildPublicMediaUrl({
        baseUrl: "https://media.protear.com",
        key: "courses/course-1/cover.webp",
        physicalKey: "staging/courses/course-1/cover.webp",
      })
    ).toBe("https://media.protear.com/staging/courses/course-1/cover.webp");
  });

  it("joins a configured public origin with a versioned object key", () => {
    expect(
      buildPublicMediaUrl({
        baseUrl: "https://media.protear.com/",
        key: "courses/course-1/cover/upload-card.webp",
      })
    ).toBe("https://media.protear.com/courses/course-1/cover/upload-card.webp");
  });

  it("rejects keys that cannot be safely exposed from the public bucket", () => {
    expect(() =>
      buildPublicMediaUrl({
        baseUrl: "https://media.protear.com",
        key: "lessons/lesson-1/resources/secret.pdf",
      })
    ).toThrow("Chave de mídia pública inválida.");
  });
});
