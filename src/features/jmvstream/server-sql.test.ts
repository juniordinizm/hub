import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JMVStream server SQL", () => {
  it("does not use ambiguous updated_at references in ordering", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("order by updated_at");
  });

  it("binds JMVStream upload sessions to lessons at init time", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("returning id");
    expect(source).toContain(
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploading', 'none')"
    );
    expect(source).toContain("uploadSessionId");
  });

  it("validates the upload session before completing a JMVStream upload", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("assertJmvstreamUploadSessionMatches");
    expect(source).toContain("uploadSessionId");
    expect(source).toContain("video_hash = $3");
  });

  it("deletes JMVStream assets by lesson and persisted video hash", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("video_external_id");
    expect(source).toContain("deleteJmvstreamAssetsForLesson");
    expect(source).toContain("or video_hash = $2");
  });

  it("keeps course folders when lesson videos are deleted", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("deleteEmptyJmvstreamFolder");
    expect(source).toContain("await client.deleteVideo(asset.video_hash)");
  });

  it("records remote delete failures for retry without blocking local unlink", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const deleteError =");
    expect(source).toContain("return false");
  });

  it("treats missing remote videos as deleted after a failed delete response", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const videos = await client.listVideos()");
    expect(source).toContain(
      "!findJmvstreamVideoByHash(videos, asset.video_hash)"
    );
    expect(source).toContain("await markJmvstreamAssetDeleted(assetId)");
  });

  it("uses course folders as the upload gallery", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("requireJmvstreamCourseFolder(lesson.course_id)");
    expect(source).not.toContain(
      "requireJmvstreamModuleFolder(lesson.module_id)"
    );
  });

  it("moves completed or synced videos into the stored course gallery", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("moveJmvstreamVideoToCourseFolder");
    expect(source).toContain("client.moveVideo(videoHash, galleryUuid)");
    expect(source).toContain("video.folderUuid !== galleryUuid");
  });

  it("defers moving videos until they are visible in the JMVStream video list", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("if (!video) {");
    expect(source).toContain("markJmvstreamAssetMovePending");
    expect(source).toContain("findJmvstreamVideoByHash(videos, videoHash)");
  });
});
