import { describe, expect, it, vi } from "vitest";
import {
  assertJmvstreamPresignedUploadUrl,
  proxyJmvstreamUploadPart,
} from "./proxy-upload";

describe("JMVStream proxied upload", () => {
  it("rejects non-JMVStream presigned upload URLs", () => {
    expect(() =>
      assertJmvstreamPresignedUploadUrl("https://example.com/upload")
    ).toThrow("URL assinada JMVStream invalida");
  });

  it("uploads a part server-side and returns the ETag", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        headers: { ETag: '"etag-proxy"' },
        status: 200,
      })
    );

    await expect(
      proxyJmvstreamUploadPart({
        body: new Uint8Array([1, 2, 3]),
        contentType: "video/mp4",
        fetcher,
        url: "https://s3.jmvstream.com/bucket/key?signature=abc",
      })
    ).resolves.toBe('"etag-proxy"');

    expect(fetcher).toHaveBeenCalledWith(
      "https://s3.jmvstream.com/bucket/key?signature=abc",
      expect.objectContaining({
        headers: { "Content-Type": "video/mp4" },
        method: "PUT",
      })
    );
  });
});
