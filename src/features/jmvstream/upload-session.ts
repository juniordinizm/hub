import "server-only";
import {
  getJmvstreamLessonContext,
  recordJmvstreamUploadSession,
} from "@/features/jmvstream/asset-persistence";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import type { JmvstreamInitUploadInput } from "@/features/jmvstream/client";
import { requireJmvstreamCourseFolder } from "@/features/jmvstream/course-folders";
import { getJmvstreamMultipartUploadConfig } from "@/features/jmvstream/upload-config";

const JMVSTREAM_VIDEO_FILE_PATTERN = /\.(?:m4v|mkv|mov|mp4|webm)$/i;

const assertSupportedJmvstreamVideoFile = (fileName: string): void => {
  if (!JMVSTREAM_VIDEO_FILE_PATTERN.test(fileName.trim())) {
    throw new Error("Selecione um arquivo de video MP4, MOV, WebM ou MKV.");
  }
};

export const initJmvstreamUpload = async ({
  fileName,
  fileSize,
  lessonId,
  uploadType,
}: {
  fileName: string;
  fileSize: number;
  lessonId: string;
  uploadType: JmvstreamInitUploadInput["uploadType"];
}) => {
  const lesson = await getJmvstreamLessonContext(lessonId);

  if (!lesson) {
    throw new Error("Aula invalida.");
  }

  assertSupportedJmvstreamVideoFile(fileName);
  const galleryUuid = await requireJmvstreamCourseFolder(lesson.course_id);
  const multipartConfig =
    uploadType === "multipart"
      ? getJmvstreamMultipartUploadConfig(fileSize)
      : null;
  const init = await (await getConfiguredJmvstreamClient()).initMultipartUpload(
    {
      ...(multipartConfig ? { chunkSize: multipartConfig.chunkSize } : {}),
      fileName,
      fileSize,
      galleryUuid,
      ...(multipartConfig ? { totalParts: multipartConfig.totalParts } : {}),
      uploadType,
    }
  );
  const uploadSessionId = await recordJmvstreamUploadSession({
    fileName,
    fileSize,
    galleryUuid,
    lesson,
    lessonId,
    objectName: init.objectName,
    uploadId: init.uploadId,
    videoHash: init.videoHash,
  });

  return {
    ...init,
    ...(multipartConfig ? { chunkSize: multipartConfig.chunkSize } : {}),
    uploadSessionId,
  };
};
