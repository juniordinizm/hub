import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  confirmLessonResourceUpload: vi.fn(),
  getLessonResourceUpload: vi.fn(),
  markLessonResourceUploadUploaded: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  confirmLessonResourceUpload: dependencies.confirmLessonResourceUpload,
}));
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  getLessonResourceUpload: dependencies.getLessonResourceUpload,
  markLessonResourceUploadUploaded:
    dependencies.markLessonResourceUploadUploaded,
}));
vi.mock("@/features/storage/lesson-resource-upload-observability", () => ({
  getLessonResourceUploadCorrelationId: vi.fn(() => "correlation-1"),
  logLessonResourceUploadEvent: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import { POST } from "./route";

const reference = {
  contentType: "application/pdf",
  fileName: "material.pdf",
  id: "resource-1",
  key: "lessons/lesson-1/resources/resource-1-material.pdf",
  label: "material.pdf",
  sizeBytes: 3,
  storage: "r2" as const,
};

describe("POST /api/admin/lessons/:lessonId/resources/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.getLessonResourceUpload.mockResolvedValue({
      actorUserId: "admin-1",
      expiresAt: new Date("2026-08-30T17:00:00.000Z"),
      lessonId: "lesson-1",
      reference,
      status: "prepared",
    });
    dependencies.confirmLessonResourceUpload.mockResolvedValue(undefined);
    dependencies.markLessonResourceUploadUploaded.mockResolvedValue(undefined);
  });

  it("confirms the main object before returning and marking the reference", async () => {
    const response = await POST(
      new Request("https://app.example.test", {
        body: JSON.stringify({ resourceId: "resource-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(200);
    expect(dependencies.confirmLessonResourceUpload).toHaveBeenCalledWith({
      contentType: reference.contentType,
      key: reference.key,
      sizeBytes: reference.sizeBytes,
    });
    expect(dependencies.markLessonResourceUploadUploaded).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      resourceId: "resource-1",
    });
    await expect(response.json()).resolves.toEqual({ reference });
  });

  it("does not mark a resource uploaded when R2 HEAD confirmation fails", async () => {
    dependencies.confirmLessonResourceUpload.mockRejectedValue(
      new Error("object missing")
    );

    const response = await POST(
      new Request("https://app.example.test", {
        body: JSON.stringify({ resourceId: "resource-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(400);
    expect(
      dependencies.markLessonResourceUploadUploaded
    ).not.toHaveBeenCalled();
  });
});
