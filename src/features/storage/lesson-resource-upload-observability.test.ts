import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import {
  getLessonResourceUploadCorrelationId,
  logLessonResourceUploadEvent,
} from "./lesson-resource-upload-observability";

describe("lesson resource upload observability", () => {
  it("uses a safe correlation ID and never logs a signed URL", () => {
    dependencies.createCorrelationId.mockReturnValue("correlation-1");
    const request = new Request("https://app.example.test", {
      headers: { "x-correlation-id": "incoming" },
    });

    const correlationId = getLessonResourceUploadCorrelationId(request);
    logLessonResourceUploadEvent({
      correlationId,
      httpStatus: 200,
      lessonId: "lesson-1",
      resourceId: "resource-1",
      sizeBytes: 1024,
      stage: "confirm",
      success: true,
    });

    expect(correlationId).toBe("correlation-1");
    expect(dependencies.createCorrelationId).toHaveBeenCalledWith("incoming");
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      aggregateId: "lesson-1",
      correlationId: "correlation-1",
      httpStatus: 200,
      operation: "lesson-resource-upload.confirm",
      outcome: "success",
      provider: "r2",
      resourceId: "resource-1",
      sizeBytes: 1024,
    });
    expect(
      JSON.stringify(dependencies.logOperationalEvent.mock.calls)
    ).not.toContain("signed");
  });
});
