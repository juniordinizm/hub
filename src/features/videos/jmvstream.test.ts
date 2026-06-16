import { describe, expect, it } from "vitest";
import {
  extractJmvstreamEmbedUrl,
  resolveLessonVideoEmbedUrl,
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
});
