import { describe, expect, it, vi } from "vitest";
import {
  authenticateJmvstreamApi,
  createJmvstreamClient,
  findJmvstreamFolderByName,
  findJmvstreamVideoByHash,
  getJmvstreamThumbnailUrlFromPlayerHtml,
  isJmvstreamJwtUsable,
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
  it("detects expired JMVStream JWTs before using them", () => {
    const expiredToken = createJwt({ exp: 1_781_770_681 });
    const validToken = createJwt({ exp: 1_781_800_000 });
    const now = new Date("2026-06-18T08:18:02.000Z");

    expect(isJmvstreamJwtUsable(expiredToken, now)).toBe(false);
    expect(isJmvstreamJwtUsable(validToken, now)).toBe(true);
    expect(isJmvstreamJwtUsable("not-a-jwt", now)).toBe(false);
  });

  it("authenticates with the documented v2 resource-only payload when a fresh token is needed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        token: "jwt-token",
      })
    );

    await expect(
      authenticateJmvstreamApi({
        apiBaseUrl: "https://api.jmvstream.com/v1",
        fetcher,
        resource: "91cc1413-16c8-4700-9f2b-c51107bac1e5",
      })
    ).resolves.toBe("jwt-token");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v2/authenticate",
      expect.objectContaining({
        body: JSON.stringify({
          resource: "91cc1413-16c8-4700-9f2b-c51107bac1e5",
        }),
        method: "POST",
      })
    );
  });

  it("rejects non-GUID JMVStream auth resources before calling the API", async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      authenticateJmvstreamApi({
        apiBaseUrl: "https://api.jmvstream.com/v1",
        fetcher,
        resource: createJwt({
          planUuid: "91cc1413-16c8-4700-9f2b-c51107bac1e5",
        }),
      })
    ).rejects.toThrow(
      "JMVSTREAM_AUTH_RESOURCE precisa ser o UUID do recurso/aplicacao da JMVStream"
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates galleries with the documented folder payload", async () => {
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
          parent: "course-folder",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
        method: "POST",
      })
    );
  });

  it("creates galleries from the current enveloped JMVStream response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        data: {
          id: 79_089,
          name: "Curso - Modulo",
          parentId: null,
          uuid: "folder-uuid",
        },
        message: "Folder created successfully",
        status: 200,
      })
    );
    const client = createClient(fetcher);

    await expect(
      client.createFolder({ name: "Curso - Modulo" })
    ).resolves.toEqual({
      id: 79_089,
      name: "Curso - Modulo",
      parentId: null,
      uuid: "folder-uuid",
    });
  });

  it("includes safe raw API details when JMVStream returns an undocumented error body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Invalid folder name", {
        headers: { "Content-Type": "text/plain" },
        status: 400,
      })
    );
    const client = createClient(fetcher);

    await expect(client.createFolder({ name: "Curso" })).rejects.toThrow(
      "JMVStream retornou erro 400: Invalid folder name"
    );
  });

  it("resolves the created gallery UUID from the folder list when create response omits it", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          name: "Curso - Modulo",
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          folders: [
            {
              name: "Curso - Modulo",
              uuid: "30789200-9352-41c8-85ed-e61cdfd5506b",
            },
          ],
        })
      );
    const client = createClient(fetcher);

    await expect(
      client.createFolder({ name: "Curso - Modulo" })
    ).resolves.toEqual({
      children: [],
      name: "Curso - Modulo",
      parentId: null,
      uuid: "30789200-9352-41c8-85ed-e61cdfd5506b",
    });
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

  it("finalizes multipart upload using JMVStream's documented part shape", async () => {
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
      parts: [
        { etag: '"def"', partNumber: 2 },
        { ETag: '"abc"', PartNumber: 1 },
      ],
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
          parts: [
            { etag: '"abc"', partNumber: 1 },
            { etag: '"def"', partNumber: 2 },
          ],
          size: 10_000,
          uploadId: "upload-1",
          video_hash: "video-hash",
        }),
        method: "POST",
      })
    );
  });

  it("returns the official player URL from upload completion when JMVStream provides one", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        jobId: "job-1",
        player_url: "https://player.jmvstream.com/evt/secret/video-hash",
        status: "success",
        video_hash: "video-hash",
      })
    );
    const client = createClient(fetcher);

    await expect(
      client.completeMultipartUpload({
        filename: "aula.mp4",
        galleryUuid: "gallery-uuid",
        objectName: "uploads/video.mp4",
        parts: [{ etag: '"abc"', partNumber: 1 }],
        size: 10_000,
        uploadId: "upload-1",
        videoHash: "video-hash",
      })
    ).resolves.toEqual({
      jobId: "job-1",
      message: null,
      playerUrl: "https://player.jmvstream.com/evt/secret/video-hash",
      status: "success",
      videoHash: "video-hash",
    });
  });

  it("extracts the generated cover URL from JMVStream player HTML", () => {
    const html = `
      <meta property="og:image" content="https://cdn.vod.br1.jmvstream.com/vod/vod_20790/f/video-hash/cover/cover1.jpg">
      <script>
        window.__PLAYER__ = {
          "thumbnail": "https://cdn.vod.br1.jmvstream.com/vod/vod_20790/f/video-hash/thumbnail/thumb.jpg?token=abc"
        }
      </script>
    `;

    expect(getJmvstreamThumbnailUrlFromPlayerHtml(html)).toBe(
      "https://cdn.vod.br1.jmvstream.com/vod/vod_20790/f/video-hash/cover/cover1.jpg"
    );
  });

  it("falls back to JMVStream thumbnail URLs and ignores unrelated images", () => {
    expect(
      getJmvstreamThumbnailUrlFromPlayerHtml(`
        <img src="https://evil.example.com/cover/cover1.jpg">
        {"thumbnail":"https://cdn.vod.br1.jmvstream.com/vod/vod_20790/f/video-hash/thumbnail/thumb.jpg?token=abc"}
      `)
    ).toBe(
      "https://cdn.vod.br1.jmvstream.com/vod/vod_20790/f/video-hash/thumbnail/thumb.jpg?token=abc"
    );
  });

  it("lists application videos with official playerSource URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        videos: [
          {
            folder_uuid: "folder-uuid",
            hash: "video-hash",
            name: "Aula.mp4",
            playerSource:
              "https://player.jmvstream.com/e2qGHOjxbs1eIaRI2gzKdr9dp6d5Fj/video-hash",
            status: "COMPLETED",
          },
        ],
      })
    );
    const client = createClient(fetcher);

    await expect(client.listVideos()).resolves.toEqual([
      {
        folderUuid: "folder-uuid",
        hash: "video-hash",
        name: "Aula.mp4",
        playerUrl:
          "https://player.jmvstream.com/e2qGHOjxbs1eIaRI2gzKdr9dp6d5Fj/video-hash",
        status: "COMPLETED",
      },
    ]);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/application",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("finds a video by hash without depending on the paginated video list", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        folder_uuid: "folder-uuid",
        hash: "video-hash",
        name: "Aula.mp4",
        playerSource:
          "https://player.jmvstream.com/e2qGHOjxbs1eIaRI2gzKdr9dp6d5Fj/video-hash",
        status: "COMPLETED",
      })
    );
    const client = createClient(fetcher);

    await expect(client.getVideo("video-hash")).resolves.toMatchObject({
      hash: "video-hash",
      status: "COMPLETED",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/video-hash",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("reads the normalized conversion job status by video hash", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        createJsonResponse({ progress: 100, status: "COMPLETED" })
      );
    const client = createClient(fetcher);

    await expect(client.getVideoJobStatus("video-hash")).resolves.toEqual(
      "COMPLETED"
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/job-status/video-hash",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("finds JMVStream videos by hash", () => {
    expect(
      findJmvstreamVideoByHash(
        [
          {
            folderUuid: "folder-uuid",
            hash: "video-hash",
            name: "Aula.mp4",
            playerUrl:
              "https://player.jmvstream.com/e2qGHOjxbs1eIaRI2gzKdr9dp6d5Fj/video-hash",
            status: "COMPLETED",
          },
        ],
        "video-hash"
      )
    )?.toEqual({
      folderUuid: "folder-uuid",
      hash: "video-hash",
      name: "Aula.mp4",
      playerUrl:
        "https://player.jmvstream.com/e2qGHOjxbs1eIaRI2gzKdr9dp6d5Fj/video-hash",
      status: "COMPLETED",
    });
  });

  it("finds existing JMVStream folders by name across parsed nested responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        folders: [
          {
            name: "Curso",
            subFolders: [
              {
                name: "Modulo 1",
                uuid: "module-folder",
              },
            ],
            uuid: "course-folder",
          },
        ],
      })
    );
    const client = createClient(fetcher);

    const folders = await client.listFolders();

    expect(findJmvstreamFolderByName(folders, " modulo 1 ")).toEqual({
      children: [],
      name: "Modulo 1",
      parentId: null,
      uuid: "module-folder",
    });
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

  it("uses the numeric JMVStream plan id when deleting OD videos", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({}));
    const client = createJmvstreamClient({
      apiBaseUrl: "https://api.jmvstream.com/v1",
      apiToken: "token-123",
      fetcher,
      planId: "OD-20790",
    });

    await client.deleteVideo("video-hash");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/deleteVideo/video-hash/20790",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("deletes folders by UUID", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({ data: 1 }));
    const client = createClient(fetcher);

    await client.deleteFolder("folder-uuid");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/folders/folder-uuid",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("moves videos to a target folder", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createJsonResponse({ status: 200 }));
    const client = createClient(fetcher);

    await client.moveVideo("video-hash", "folder-uuid");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.jmvstream.com/v1/videos/moveVideo/video-hash",
      expect.objectContaining({
        body: JSON.stringify({ gallery: "folder-uuid" }),
        method: "PUT",
      })
    );
  });
});

const createJwt = (payload: Record<string, unknown>): string => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  return `header.${encodedPayload}.signature`;
};
