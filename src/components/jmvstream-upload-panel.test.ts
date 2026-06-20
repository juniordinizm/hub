import { describe, expect, it, vi } from "vitest";
import { uploadFileParts } from "../features/jmvstream/upload";

const createFile = () =>
  new File(["abcdef"], "aula.mp4", {
    type: "video/mp4",
  });

describe("Jmvstream upload helpers", () => {
  it("uses the selected video MIME type and returns ordered documented parts", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(null, {
          headers: { ETag: '"etag-value"' },
          status: 200,
        })
    );

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
      })
    ).resolves.toEqual([{ ETag: '"etag-value"', PartNumber: 1 }]);

    expect(fetcher).toHaveBeenCalledWith(
      "https://s3.local/part-1",
      expect.objectContaining({
        headers: { "Content-Type": "video/mp4" },
        method: "PUT",
      })
    );
  });

  it("fails before completion when a JMVStream S3 PUT does not expose ETag", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
      })
    );

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
      })
    ).rejects.toThrow("ETag");
  });

  it("fails clearly when the browser blocks the direct S3 PUT", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
      })
    ).rejects.toThrow("CORS/Expose-Headers: ETag");
  });

  it("uses a configured dedicated proxy when the browser blocks the direct S3 PUT", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { ETag: '"proxied-etag"' },
          status: 200,
        })
      );

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
        uploadPartProxyUrl: "/api/jmvstream/upload-part",
      })
    ).resolves.toEqual([{ ETag: '"proxied-etag"', PartNumber: 1 }]);

    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/jmvstream/upload-part?url=https%3A%2F%2Fs3.local%2Fpart-1",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("uses a configured dedicated proxy when the direct S3 PUT does not expose ETag", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { ETag: '"proxied-etag"' },
          status: 200,
        })
      );

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
        uploadPartProxyUrl: "/api/jmvstream/upload-part",
      })
    ).resolves.toEqual([{ ETag: '"proxied-etag"', PartNumber: 1 }]);
  });
});
