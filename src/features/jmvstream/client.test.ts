import { describe, expect, it, vi } from "vitest";
import {
  createJmvstreamClient,
  normalizeJmvstreamApiBaseUrl,
  normalizeJmvstreamUploadParts,
} from "./client";

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });

const createClient = (fetcher: typeof fetch) =>
  createJmvstreamClient({
    apiBaseUrl: "https://api.jmvstream.com/v1",
    apiToken: "token-123",
    fetcher,
    planId: "plan-456",
  });

describe("JMVStream API client", () => {
  it("normalizes configured base URL to the API origin", () => {
    expect(normalizeJmvstreamApiBaseUrl("https://api.jmvstream.com/v1")).toBe(
      "https://api.jmvstream.com"
    );
  });

  it("creates course and module folders with bearer auth", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        name: "Modulo 1",
        uuid: "folder-uuid",
      })
    );
    const client = createClient(fetcher);

    await expect(
      client.createFolder({
        name: "Modulo 1",
        parentFolderUuid: "course-folder",
      })
    ).resolves.toEqual({
      id: undefined,
      name: "Modulo 1",
      parentId: null,
      uuid: "folder-uuid",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/folders",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Modulo 1",
          parent_uuid: "course-folder",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
        method: "POST",
      })
    );
  });

  it("starts S3 multipart upload in the target gallery", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        objectName: "uploads/video.mp4",
        presignedUrls: [{ partNumber: 1, url: "https://s3/upload" }],
        uploadId: "upload-1",
        video_hash: "video-hash",
      })
    );
    const client = createClient(fetcher);

    await expect(
      client.initMultipartUpload({
        chunkSize: 8_388_608,
        fileName: "aula.mp4",
        fileSize: 10_000,
        galleryUuid: "gallery-uuid",
        totalParts: 1,
        uploadType: "multipart",
      })
    ).resolves.toEqual({
      objectName: "uploads/video.mp4",
      presignedUrls: [{ partNumber: 1, url: "https://s3/upload" }],
      uploadId: "upload-1",
      videoHash: "video-hash",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v2/upload/multipart/s3",
      expect.objectContaining({
        body: JSON.stringify({
          chunkSize: 8_388_608,
          fileName: "aula.mp4",
          fileSize: 10_000,
          gallery: "gallery-uuid",
          totalParts: 1,
          uploadType: "multipart",
        }),
      })
    );
  });

  it("normalizes multipart completion parts to the documented shape", async () => {
    expect(
      normalizeJmvstreamUploadParts([{ etag: '"abc"', partNumber: 1 }])
    ).toEqual([{ ETag: '"abc"', PartNumber: 1 }]);

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        jobId: "job-1",
        status: "success",
        video_hash: "video-hash",
      })
    );
    const client = createClient(fetcher);

    await client.completeMultipartUpload({
      filename: "aula.mp4",
      galleryUuid: "gallery-uuid",
      objectName: "uploads/video.mp4",
      parts: [{ etag: '"abc"', partNumber: 1 }],
      size: 10_000,
      uploadId: "upload-1",
      videoHash: "video-hash",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v2/upload/multipart/complete",
      expect.objectContaining({
        body: JSON.stringify({
          filename: "aula.mp4",
          gallery: "gallery-uuid",
          objectName: "uploads/video.mp4",
          parts: [{ ETag: '"abc"', PartNumber: 1 }],
          size: 10_000,
          uploadId: "upload-1",
          video_hash: "video-hash",
        }),
        method: "POST",
      })
    );
  });

  it("deletes videos by hash and configured plan id", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({}));
    const client = createClient(fetcher);

    await client.deleteVideo("hash/with/slash");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/deleteVideo/hash%2Fwith%2Fslash/plan-456",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
