import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("JMVStream server SQL", () => {
  it("does not use ambiguous updated_at references in ordering", async () => {
    const source = await readFile(
      new URL("./asset-persistence.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("order by updated_at");
  });

  it("binds JMVStream upload sessions to lessons at init time", async () => {
    const [uploadSource, persistenceSource] = await Promise.all([
      readFile(new URL("./upload-session.ts", import.meta.url), "utf8"),
      readFile(new URL("./asset-persistence.ts", import.meta.url), "utf8"),
    ]);

    expect(uploadSource).toContain("recordJmvstreamUploadSession");
    expect(persistenceSource).toContain("returning id");
    expect(persistenceSource).toContain(
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploading', 'none')"
    );
    expect(uploadSource).toContain("uploadSessionId");
  });

  it("validates the upload session before completing a JMVStream upload", async () => {
    const [completionSource, persistenceSource] = await Promise.all([
      readFile(new URL("./upload-completion.ts", import.meta.url), "utf8"),
      readFile(new URL("./asset-persistence.ts", import.meta.url), "utf8"),
    ]);

    expect(completionSource).toContain("assertJmvstreamUploadSessionMatches");
    expect(completionSource).toContain("uploadSessionId");
    expect(persistenceSource).toContain("video_hash = $3");
  });

  it("links the replacement upload to the lesson before deleting the previous asset", async () => {
    const source = await readFile(
      new URL("./upload-completion.ts", import.meta.url),
      "utf8"
    );

    const lessonUpdateIndex = source.indexOf("linkJmvstreamVideoToLesson");
    const cleanupIndex = source.indexOf(
      "await deleteActiveAssetsForLesson(lessonId, videoHash);"
    );

    expect(lessonUpdateIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(lessonUpdateIndex);
  });

  it("deletes JMVStream assets by lesson and persisted video hash", async () => {
    const source = await readFile(
      new URL("./asset-deletion.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("video_external_id");
    expect(source).toContain("deleteJmvstreamAssetsForLesson");
    expect(source).toContain("or video_hash = $2");
  });

  it("keeps course folders when lesson videos are deleted", async () => {
    const source = await readFile(
      new URL("./asset-deletion.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("deleteEmptyJmvstreamFolder");
    expect(source).toContain("await client.deleteVideo(asset.video_hash)");
  });

  it("records remote delete failures for retry without blocking local unlink", async () => {
    const source = await readFile(
      new URL("./asset-deletion.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const deleteError =");
    expect(source).toContain("return false");
  });

  it("treats missing remote videos as deleted after a failed delete response", async () => {
    const source = await readFile(
      new URL("./asset-deletion.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("await client.getVideo(asset.video_hash)");
    expect(source).toContain("await markJmvstreamAssetDeleted(assetId)");
  });

  it("uses course folders as the upload gallery", async () => {
    const source = await readFile(
      new URL("./upload-session.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("requireJmvstreamCourseFolder(lesson.course_id)");
    expect(source).not.toContain(
      "requireJmvstreamModuleFolder(lesson.module_id)"
    );
  });

  it("moves completed or synced videos into the stored course gallery", async () => {
    const [source, mapperSource] = await Promise.all([
      readFile(new URL("./player-sync.ts", import.meta.url), "utf8"),
      readFile(new URL("./provider-mapper.ts", import.meta.url), "utf8"),
    ]);

    expect(source).toContain("moveJmvstreamVideoToCourseFolder");
    expect(source).toContain("getJmvstreamVideoPlacement");
    expect(source).toContain("client.moveVideo(videoHash, galleryUuid)");
    expect(mapperSource).toContain("video.folderUuid === galleryUuid");
  });

  it("defers moving videos until they are visible through the focused JMVStream lookup", async () => {
    const [source, mapperSource] = await Promise.all([
      readFile(new URL("./player-sync.ts", import.meta.url), "utf8"),
      readFile(new URL("./provider-mapper.ts", import.meta.url), "utf8"),
    ]);

    expect(source).toContain('placement === "missing"');
    expect(source).toContain("markJmvstreamAssetMovePending");
    expect(source).toContain("await client.getVideo(videoHash)");
    expect(mapperSource).toContain("if (!video) {");
  });

  it("reconciles processing uploads without depending on an open browser tab", async () => {
    const [playerSource, persistenceSource] = await Promise.all([
      readFile(new URL("./player-sync.ts", import.meta.url), "utf8"),
      readFile(new URL("./asset-persistence.ts", import.meta.url), "utf8"),
    ]);

    expect(playerSource).toContain("syncPendingJmvstreamPlayers");
    expect(playerSource).toContain("getPendingJmvstreamPlayerLessons");
    expect(playerSource).toContain("await syncJmvstreamLessonPlayer(lessonId)");
    expect(persistenceSource).toContain("where upload_status = 'processing'");
  });

  it("reconciles each lesson through a focused video lookup and conversion job", async () => {
    const source = await readFile(
      new URL("./player-sync.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("await client.getVideo(videoHash)");
    expect(source).toContain("await client.getVideoJobStatus(videoHash)");
    expect(source).toContain('jobStatus === "ERROR"');
  });

  it("expires abandoned uploads before processing pending players", async () => {
    const [persistenceSource, playerSource] = await Promise.all([
      readFile(new URL("./asset-persistence.ts", import.meta.url), "utf8"),
      readFile(new URL("./player-sync.ts", import.meta.url), "utf8"),
    ]);

    expect(persistenceSource).toContain(
      "export const expireStaleJmvstreamUploads"
    );
    expect(playerSource).toContain("await expireStaleJmvstreamUploads()");
  });
});
