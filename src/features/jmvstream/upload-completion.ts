import "server-only";
import { deleteActiveAssetsForLesson } from "@/features/jmvstream/asset-deletion";
import {
  assertJmvstreamUploadSessionMatches,
  assertJmvstreamVideoHashAvailable,
  getJmvstreamLessonContext,
  linkJmvstreamVideoToLesson,
  markJmvstreamUploadFailed,
  recordCompletedJmvstreamUpload,
} from "@/features/jmvstream/asset-persistence";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import type {
  JmvstreamCompleteUploadInput,
  JmvstreamCompleteUploadResponse,
} from "@/features/jmvstream/client";
import { requireJmvstreamCourseFolder } from "@/features/jmvstream/course-folders";
import {
  moveJmvstreamVideoToCourseFolder,
  resolveJmvstreamPlayerThumbnailUrl,
} from "@/features/jmvstream/player-sync";

export const completeJmvstreamUpload = async ({
  filename,
  lessonId,
  objectName,
  parts,
  size,
  uploadSessionId,
  uploadId,
  videoHash,
}: Omit<JmvstreamCompleteUploadInput, "galleryUuid"> & {
  lessonId: string;
  uploadSessionId: string;
}): Promise<void> => {
  const lesson = await getJmvstreamLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  await assertJmvstreamUploadSessionMatches({
    lessonId,
    uploadSessionId,
    videoHash,
  });
  await assertJmvstreamVideoHashAvailable(videoHash, lessonId);
  const galleryUuid = await requireJmvstreamCourseFolder(lesson.course_id);
  const client = await getConfiguredJmvstreamClient();
  let response: JmvstreamCompleteUploadResponse;

  try {
    response = await client.completeMultipartUpload({
      filename,
      galleryUuid,
      objectName,
      parts,
      size,
      uploadId,
      videoHash,
    });
  } catch (error) {
    await markJmvstreamUploadFailed({
      lastError:
        error instanceof Error
          ? error.message
          : "Nao foi possivel finalizar o upload na JMVStream.",
      videoHash,
    });
    throw error;
  }

  const syncedVideo = await client.getVideo(videoHash).catch(() => null);
  await moveJmvstreamVideoToCourseFolder({
    client,
    galleryUuid,
    video: syncedVideo,
    videoHash,
  });
  const playerUrl = response.playerUrl ?? syncedVideo?.playerUrl ?? null;
  const thumbnailUrl = await resolveJmvstreamPlayerThumbnailUrl(playerUrl);
  const uploadStatus = playerUrl ? "ready" : "processing";
  await recordCompletedJmvstreamUpload({
    filename,
    galleryUuid,
    jobId: response.jobId,
    lesson,
    lessonId,
    objectName,
    size,
    uploadId,
    uploadStatus,
    videoHash,
  });
  await linkJmvstreamVideoToLesson({
    lessonId,
    playerUrl,
    thumbnailUrl,
    videoHash,
  });
  await deleteActiveAssetsForLesson(lessonId, videoHash);
};
