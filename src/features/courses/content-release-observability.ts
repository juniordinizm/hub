import "server-only";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";

export type ContentReleaseInvalidReason =
  | "invalid_anchor"
  | "invalid_clock"
  | "invalid_delay"
  | "invalid_mode"
  | "invalid_schedule";

export type ContentReleaseOperationalCode =
  | "content_release_digest_conflict"
  | "content_release_invalid_state"
  | "content_release_override_granted"
  | "content_release_override_rejected";

export interface ContentReleaseDiagnostics {
  reportInvalidState(input: {
    courseId: string;
    moduleId?: string;
    reason: ContentReleaseInvalidReason;
  }): void;
}

export const reportContentReleaseOperationalEvent = ({
  code,
  correlationId = createCorrelationId(null),
  courseId,
  moduleId,
}: {
  code: ContentReleaseOperationalCode;
  correlationId?: string;
  courseId: string;
  moduleId?: string;
}): void => {
  logOperationalEvent({
    aggregateId: courseId,
    correlationId,
    errorCode: code,
    operation: `content_release.${code.replace("content_release_", "")}`,
    outcome:
      code.endsWith("_rejected") || code.endsWith("_conflict")
        ? "failure"
        : "success",
    ...(moduleId ? { resourceId: moduleId } : {}),
  });
};

export const classifyContentReleaseError = (
  error: unknown
): ContentReleaseInvalidReason => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("sem inicio da entrega")) {
    return "invalid_anchor";
  }
  if (message.includes("Atraso de liberação")) {
    return "invalid_delay";
  }
  if (message.includes("Relógio")) {
    return "invalid_clock";
  }
  if (message.includes("Modo de liberação")) {
    return "invalid_mode";
  }
  return "invalid_schedule";
};

export const createContentReleaseDiagnostics = (
  correlationId = createCorrelationId(null)
): ContentReleaseDiagnostics => {
  const reportedKeys = new Set<string>();

  return {
    reportInvalidState: ({ courseId, moduleId, reason }) => {
      const key = `${courseId}:${moduleId ?? ""}:${reason}`;
      if (reportedKeys.has(key)) {
        return;
      }
      reportedKeys.add(key);
      logOperationalEvent({
        aggregateId: courseId,
        correlationId,
        errorCode: "content_release_invalid_state",
        operation: `content_release.resolve.${reason}`,
        outcome: "failure",
        ...(moduleId ? { resourceId: moduleId } : {}),
      });
    },
  };
};
