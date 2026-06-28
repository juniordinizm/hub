import { describe, expect, it } from "vitest";
import {
  getLessonVideoEditorMode,
  resolveLessonVideoFormState,
  resolveLessonVideoPreviewUrl,
} from "./lesson-video-form";

describe("lesson video form", () => {
  it("previews the submitted manual link over the saved player url", () => {
    expect(
      resolveLessonVideoPreviewUrl({
        savedEmbedUrl: "https://player.jmvstream.com/saved",
        shouldRemoveVideo: false,
        submittedEmbedUrl: "https://player.jmvstream.com/draft",
      })
    ).toBe("https://player.jmvstream.com/draft");
  });

  it("keeps the saved player preview when the submitted link is empty or invalid", () => {
    expect(
      resolveLessonVideoPreviewUrl({
        savedEmbedUrl: "https://player.jmvstream.com/saved",
        shouldRemoveVideo: false,
        submittedEmbedUrl: "",
      })
    ).toBe("https://player.jmvstream.com/saved");
    expect(
      resolveLessonVideoPreviewUrl({
        savedEmbedUrl: "https://player.jmvstream.com/saved",
        shouldRemoveVideo: false,
        submittedEmbedUrl: "https://example.com/video",
      })
    ).toBe("https://player.jmvstream.com/saved");
  });

  it("hides the preview when the remove video flag is selected", () => {
    expect(
      resolveLessonVideoPreviewUrl({
        savedEmbedUrl: "https://player.jmvstream.com/saved",
        shouldRemoveVideo: true,
        submittedEmbedUrl: "https://player.jmvstream.com/draft",
      })
    ).toBeNull();
  });

  it("opens the upload tab for uploaded or empty video states", () => {
    expect(
      getLessonVideoEditorMode({
        videoEmbedUrl: "https://player.jmvstream.com/uploaded",
        videoExternalId: "asset-hash",
      })
    ).toBe("upload");
    expect(
      getLessonVideoEditorMode({
        videoEmbedUrl: null,
        videoExternalId: null,
      })
    ).toBe("upload");
  });

  it("opens the link tab when a lesson only has a manual video link", () => {
    expect(
      getLessonVideoEditorMode({
        videoEmbedUrl: "https://player.jmvstream.com/manual",
        videoExternalId: null,
      })
    ).toBe("link");
  });

  it("preserves an existing uploaded video when no manual link is submitted", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: {
          embedUrl: "https://player.jmvstream.com/uploaded",
          externalId: "asset-hash",
        },
        shouldRemoveVideo: false,
        submittedEmbedUrl: null,
      })
    ).toEqual({
      hasVideoContent: true,
      shouldDeleteJmvstreamAsset: false,
      shouldKeepJmvstreamAsset: true,
      videoEmbedUrl: "https://player.jmvstream.com/uploaded",
      videoExternalId: "asset-hash",
      videoProvider: "jmvstream",
    });
  });

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
      shouldDeleteJmvstreamAsset: false,
      shouldKeepJmvstreamAsset: false,
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
      shouldDeleteJmvstreamAsset: false,
      shouldKeepJmvstreamAsset: false,
      videoEmbedUrl: "https://player.jmvstream.com/new",
      videoExternalId: null,
      videoProvider: "jmvstream",
    });
  });

  it("replaces an uploaded video asset when a manual link is submitted", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: {
          embedUrl: "https://player.jmvstream.com/uploaded",
          externalId: "asset-hash",
        },
        shouldRemoveVideo: false,
        submittedEmbedUrl: "https://player.jmvstream.com/manual",
      })
    ).toEqual({
      hasVideoContent: true,
      shouldDeleteJmvstreamAsset: true,
      shouldKeepJmvstreamAsset: false,
      videoEmbedUrl: "https://player.jmvstream.com/manual",
      videoExternalId: null,
      videoProvider: "jmvstream",
    });
  });

  it("does not delete JMVStream assets when a save happens before upload completion", () => {
    expect(
      resolveLessonVideoFormState({
        existingVideo: null,
        shouldRemoveVideo: false,
        submittedEmbedUrl: null,
      })
    ).toEqual({
      hasVideoContent: false,
      shouldDeleteJmvstreamAsset: false,
      shouldKeepJmvstreamAsset: false,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
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
      shouldDeleteJmvstreamAsset: true,
      shouldKeepJmvstreamAsset: false,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
    });
  });
});
