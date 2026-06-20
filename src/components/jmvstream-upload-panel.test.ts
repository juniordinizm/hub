import { describe, expect, it, vi } from "vitest";
import { uploadFileParts } from "../features/jmvstream/upload";
import { JMVSTREAM_UPLOAD_CONCURRENCY } from "../features/jmvstream/upload-config";

const createFile = () =>
  new File(["abcdef"], "aula.mp4", {
    type: "video/mp4",
  });

describe("Jmvstream upload helpers", () => {
  it("uploads direct S3 parts without custom headers and returns ordered documented parts", async () => {
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
        method: "PUT",
      })
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("headers");
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

  it("does not re-upload through an application proxy when the direct S3 PUT succeeds without exposed ETag", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      uploadFileParts({
        fetcher,
        file: createFile(),
        onProgress: vi.fn(),
        presignedUrls: [{ partNumber: 1, url: "https://s3.local/part-1" }],
      })
    ).rejects.toThrow("ETag");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uploads large files with bounded parallel part uploads", async () => {
    const pendingUploads: Array<() => void> = [];
    let activeUploads = 0;
    let maxActiveUploads = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Promise<Response>((resolve) => {
          activeUploads += 1;
          maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
          pendingUploads.push(() => {
            activeUploads -= 1;
            resolve(
              new Response(null, {
                headers: { ETag: `"etag-${pendingUploads.length}"` },
                status: 200,
              })
            );
          });
        })
    );
    const uploadPromise = uploadFileParts({
      fetcher,
      file: new File(["abcdefghij"], "aula.mp4", { type: "video/mp4" }),
      onProgress: vi.fn(),
      presignedUrls: Array.from(
        { length: JMVSTREAM_UPLOAD_CONCURRENCY + 1 },
        (_, index) => ({
          partNumber: index + 1,
          url: `https://s3.local/part-${index + 1}`,
        })
      ),
    });

    await waitUntil(
      () => pendingUploads.length === JMVSTREAM_UPLOAD_CONCURRENCY
    );
    expect(maxActiveUploads).toBe(JMVSTREAM_UPLOAD_CONCURRENCY);

    for (const resolveUpload of pendingUploads.splice(0)) {
      resolveUpload();
    }

    await waitUntil(
      () => fetcher.mock.calls.length === JMVSTREAM_UPLOAD_CONCURRENCY + 1
    );
    for (const resolveUpload of pendingUploads.splice(0)) {
      resolveUpload();
    }

    await expect(uploadPromise).resolves.toHaveLength(
      JMVSTREAM_UPLOAD_CONCURRENCY + 1
    );
    expect(maxActiveUploads).toBe(JMVSTREAM_UPLOAD_CONCURRENCY);
  });
});

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  while (!predicate()) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
