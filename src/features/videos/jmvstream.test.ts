import { describe, expect, it } from "vitest";
import {
  extractJmvstreamEmbedUrl,
  formatLessonDuration,
  getJmvstreamDurationSecondsFromMessage,
  getJmvstreamPlayerEventFromMessage,
  resolveLessonVideoEmbedUrl,
  shouldApplyDetectedDuration,
  shouldCompleteLessonFromJmvstreamEvent,
} from "./jmvstream";

describe("JMVStream video embeds", () => {
  it("extracts the iframe src from the official player share code", () => {
    expect(
      extractJmvstreamEmbedUrl(
        "<iframe class='jmvplayer' src='https://player.jmvstream.com/evt/secret/hash' allowfullscreen></iframe>"
      )
    ).toBe("https://player.jmvstream.com/evt/secret/hash");
  });

  it("accepts a direct JMVStream player URL", () => {
    expect(
      extractJmvstreamEmbedUrl("https://player.jmvstream.com/evt/secret/hash")
    ).toBe("https://player.jmvstream.com/evt/secret/hash");
  });

  it("rejects non-JMVStream URLs for JMV lessons", () => {
    expect(
      resolveLessonVideoEmbedUrl({
        embedUrl: "https://example.com/video",
        provider: "jmvstream",
      })
    ).toBeNull();
  });

  it("keeps external provider embeds unchanged", () => {
    expect(
      resolveLessonVideoEmbedUrl({
        embedUrl: "https://example.com/video",
        provider: "external",
      })
    ).toBe("https://example.com/video");
  });

  it("extracts exact seconds from player status messages", () => {
    expect(
      getJmvstreamDurationSecondsFromMessage(
        JSON.stringify({
          event: "jmvplayerout-status",
          duration: 733,
          currentTime: 12,
        })
      )
    ).toBe(733);
  });

  it("accepts documented eventName player messages", () => {
    expect(
      getJmvstreamDurationSecondsFromMessage({
        eventName: "jmvplayerout-play",
        duration: 120,
      })
    ).toBe(120);
  });

  it("ignores malformed player messages and missing durations", () => {
    expect(getJmvstreamDurationSecondsFromMessage("not-json")).toBeNull();
    expect(
      getJmvstreamDurationSecondsFromMessage({
        event: "jmvplayerout-status",
        currentTime: 12,
      })
    ).toBeNull();
  });

  it("normalizes documented player progress events", () => {
    expect(
      getJmvstreamPlayerEventFromMessage(
        JSON.stringify({
          currentTime: 56.8,
          duration: 120,
          event: "jmvplayerout-status",
          paused: false,
        })
      )
    ).toEqual({
      currentSeconds: 57,
      durationSeconds: 120,
      eventName: "jmvplayerout-status",
      watchedPercent: 48,
    });
  });

  it("normalizes documented player end events", () => {
    expect(
      getJmvstreamPlayerEventFromMessage({
        currentTime: 118,
        duration: 120,
        eventName: "jmvplayerout-end",
      })
    ).toEqual({
      currentSeconds: 118,
      durationSeconds: 120,
      eventName: "jmvplayerout-end",
      watchedPercent: 98,
    });
  });

  it("ignores player messages without current time or duration", () => {
    expect(
      getJmvstreamPlayerEventFromMessage({
        duration: 120,
        event: "jmvplayerout-status",
      })
    ).toBeNull();
  });

  it("completes lessons only when the JMVStream end event is effectively complete", () => {
    expect(
      shouldCompleteLessonFromJmvstreamEvent({
        eventName: "jmvplayerout-end",
        watchedPercent: 20,
      })
    ).toBe(true);
    expect(
      shouldCompleteLessonFromJmvstreamEvent({
        eventName: "jmvplayerout-status",
        watchedPercent: 95,
      })
    ).toBe(true);
    expect(
      shouldCompleteLessonFromJmvstreamEvent({
        eventName: "jmvplayerout-status",
        watchedPercent: 80,
      })
    ).toBe(false);
    expect(
      shouldCompleteLessonFromJmvstreamEvent({
        eventName: "jmvplayerout-skip",
        watchedPercent: 80,
      })
    ).toBe(false);
  });

  it("formats lesson durations with minutes and seconds", () => {
    expect(formatLessonDuration(733)).toBe("12 min 13 s");
    expect(formatLessonDuration(120)).toBe("2 min");
    expect(formatLessonDuration(45)).toBe("45 s");
  });

  it("applies detected duration when stored duration is stale and user did not edit", () => {
    expect(
      shouldApplyDetectedDuration({
        currentSeconds: 120,
        detectedSeconds: 113,
        userEdited: false,
      })
    ).toBe(true);
  });

  it("keeps manual duration edits even when player reports another value", () => {
    expect(
      shouldApplyDetectedDuration({
        currentSeconds: 120,
        detectedSeconds: 113,
        userEdited: true,
      })
    ).toBe(false);
  });
});
