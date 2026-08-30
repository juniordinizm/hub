export const LESSON_SERVER_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

export type LessonResourceUploadStatus =
  | "cleaning"
  | "consumed"
  | "prepared"
  | "uploaded";

export interface LessonResourceUploadPreviewReference {
  contentType: "image/webp";
  height: number;
  key: string;
  sizeBytes: number;
  width: number;
}

export interface LessonResourceUploadReference {
  contentType: string;
  fileName: string;
  id: string;
  key: string;
  label: string;
  preview?: LessonResourceUploadPreviewReference;
  sizeBytes: number;
  storage: "r2";
}

export interface PreparedLessonResourceUpload {
  expiresAt: string;
  previewUploadUrl?: string;
  reference: LessonResourceUploadReference;
  uploadUrl: string;
}

export interface LessonResourceUploadSession {
  actorUserId: string;
  expiresAt: Date;
  lessonId: string;
  reference: LessonResourceUploadReference;
  status: LessonResourceUploadStatus;
}

export const assertLessonResourceUploadReferenceMatches = ({
  expected,
  received,
}: {
  expected: LessonResourceUploadReference;
  received: LessonResourceUploadReference;
}): void => {
  if (
    expected.contentType !== received.contentType ||
    expected.fileName !== received.fileName ||
    expected.id !== received.id ||
    expected.key !== received.key ||
    expected.sizeBytes !== received.sizeBytes ||
    JSON.stringify(expected.preview ?? null) !==
      JSON.stringify(received.preview ?? null)
  ) {
    throw new Error("O upload temporario nao corresponde ao material.");
  }
};
