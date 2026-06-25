import { describe, expect, it } from "vitest";
import { resolveLessonVideoFormState } from "./lesson-video-form";

describe("lesson video form", () => {
  it("preserves an existing manual video link when the edit form submits without a new link", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: {
          embedUrl: "https://player.jmvstream.com/lQm9WyK7",
          externalId: null,
        },
        shouldRemoveVideo: false,
        submittedEmbedUrl: null,
      })
    ).toEqual({
      hasVideoContent: true,
      videoEmbedUrl: "https://player.jmvstream.com/lQm9WyK7",
      videoExternalId: null,
      videoProvider: "jmvstream",
    });
  });

  it("replaces the existing video link when a new link is submitted", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: {
          embedUrl: "https://player.jmvstream.com/old",
          externalId: null,
        },
        shouldRemoveVideo: false,
        submittedEmbedUrl: "https://player.jmvstream.com/new",
      })
    ).toEqual({
      hasVideoContent: true,
      videoEmbedUrl: "https://player.jmvstream.com/new",
      videoExternalId: null,
      videoProvider: "jmvstream",
    });
  });

  it("removes video content only when the removal flag is submitted", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: {
          embedUrl: "https://player.jmvstream.com/lQm9WyK7",
          externalId: "asset-hash",
        },
        shouldRemoveVideo: true,
        submittedEmbedUrl: "",
      })
    ).toEqual({
      hasVideoContent: false,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
    });
  });
});
