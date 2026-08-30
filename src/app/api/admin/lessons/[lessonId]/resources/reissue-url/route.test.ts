import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createLessonResourceUploadUrlForReference: vi.fn(),
  getPreparedLessonResourceUpload: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  createLessonResourceUploadUrlForReference:
    dependencies.createLessonResourceUploadUrlForReference,
}));
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  getPreparedLessonResourceUpload: dependencies.getPreparedLessonResourceUpload,
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

const session = {
  actorUserId: "admin-1",
  expiresAt: new Date("2026-08-30T17:00:00.000Z"),
  lessonId: "lesson-1",
  reference,
  status: "prepared" as const,
};

describe("POST /api/admin/lessons/:lessonId/resources/reissue-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.getPreparedLessonResourceUpload.mockResolvedValue(session);
    dependencies.createLessonResourceUploadUrlForReference.mockResolvedValue({
      expiresAt: "2026-08-30T16:10:00.000Z",
      reference,
      uploadUrl: "https://r2.example.test/upload-2",
    });
  });

  it("reissues a URL for the existing resource key", async () => {
    const response = await POST(
      new Request("https://app.example.test", {
        body: JSON.stringify({ resourceId: "resource-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(200);
    expect(
      dependencies.createLessonResourceUploadUrlForReference
    ).toHaveBeenCalledWith({ reference });
    await expect(response.json()).resolves.toEqual({
      expiresAt: "2026-08-30T16:10:00.000Z",
      reference,
      uploadUrl: "https://r2.example.test/upload-2",
    });
  });

  it("does not generate a URL for an unavailable session", async () => {
    dependencies.getPreparedLessonResourceUpload.mockResolvedValue(null);

    const response = await POST(
      new Request("https://app.example.test", {
        body: JSON.stringify({ resourceId: "resource-1" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(404);
    expect(
      dependencies.createLessonResourceUploadUrlForReference
    ).not.toHaveBeenCalled();
  });
});
