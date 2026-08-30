import "server-only";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

export type LessonResourceUploadStage =
  | "confirm"
  | "consume"
  | "fallback"
  | "prepare"
  | "reissue";

export const getLessonResourceUploadCorrelationId = (
  request: Request
): string => createCorrelationId(request.headers.get(CORRELATION_ID_HEADER));

export const logLessonResourceUploadEvent = ({
  correlationId,
  errorCode,
  httpStatus,
  lessonId,
  resourceId,
  sizeBytes,
  stage,
  success,
}: {
  correlationId: string;
  errorCode?: string;
  httpStatus?: number;
  lessonId: string;
  resourceId?: string;
  sizeBytes?: number;
  stage: LessonResourceUploadStage;
  success: boolean;
}): void => {
  logOperationalEvent({
    aggregateId: lessonId,
    correlationId,
    ...(errorCode ? { errorCode } : {}),
    ...(httpStatus ? { httpStatus } : {}),
    operation: `lesson-resource-upload.${stage}`,
    outcome: success ? "success" : "failure",
    provider: "r2",
    ...(resourceId ? { resourceId } : {}),
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
  });
};
