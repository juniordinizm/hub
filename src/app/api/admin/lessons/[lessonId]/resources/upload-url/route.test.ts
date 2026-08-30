import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createLessonResourceUploadUrl: vi.fn(),
  getPool: vi.fn(),
  registerLessonResourceUpload: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  createLessonResourceUploadUrl: dependencies.createLessonResourceUploadUrl,
}));
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  registerLessonResourceUpload: dependencies.registerLessonResourceUpload,
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

const createRequest = (): Request =>
  new Request(
    "https://app.example.test/api/admin/lessons/lesson-1/resources/upload-url",
    {
      body: JSON.stringify({
        contentType: "application/pdf",
        fileName: "material.pdf",
        sizeBytes: 3,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

describe("POST /api/admin/lessons/:lessonId/resources/upload-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
    });
    dependencies.createLessonResourceUploadUrl.mockResolvedValue({
      expiresAt: "2026-08-30T16:00:00.000Z",
      reference,
      uploadUrl: "https://r2.example.test/upload",
    });
    dependencies.registerLessonResourceUpload.mockResolvedValue(undefined);
  });

  it("registers the prepared resource before returning its signed URL", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ lessonId: "lesson-1" }),
    });

    expect(response.status).toBe(200);
    expect(dependencies.registerLessonResourceUpload).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      reference,
    });
    await expect(response.json()).resolves.toEqual({
      expiresAt: "2026-08-30T16:00:00.000Z",
      reference,
      uploadUrl: "https://r2.example.test/upload",
    });
  });

  it("does not return a signed URL when the upload session cannot be registered", async () => {
    dependencies.registerLessonResourceUpload.mockRejectedValue(
      new Error("database unavailable")
    );

    const response = await POST(createRequest(), {
      params: Promise.resolve({ lessonId: "lesson-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      correlationId: "correlation-1",
      error: "database unavailable",
    });
  });

  it("rejects malformed JSON without invoking the signer", async () => {
    const response = await POST(
      new Request("https://app.example.test", {
        body: "{",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(400);
    expect(dependencies.createLessonResourceUploadUrl).not.toHaveBeenCalled();
  });
});
