import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  confirmLessonResourceUpload: vi.fn(),
  getPreparedLessonResourceUpload: vi.fn(),
  markLessonResourceUploadUploaded: vi.fn(),
  requireRole: vi.fn(),
  uploadPrivateR2Object: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  confirmLessonResourceUpload: dependencies.confirmLessonResourceUpload,
  uploadPrivateR2Object: dependencies.uploadPrivateR2Object,
}));
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  getPreparedLessonResourceUpload: dependencies.getPreparedLessonResourceUpload,
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

const session = {
  actorUserId: "admin-1",
  expiresAt: new Date("2026-08-30T17:00:00.000Z"),
  lessonId: "lesson-1",
  reference,
  status: "prepared" as const,
};

const createRequest = ({
  file = new File(["pdf"], "material.pdf", { type: "application/pdf" }),
  resourceId = "resource-1",
}: {
  file?: File | null;
  resourceId?: string;
} = {}): Request => {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }
  formData.set("resourceId", resourceId);
  return new Request("https://app.example.test", {
    body: formData,
    method: "POST",
  });
};

describe("POST /api/admin/lessons/:lessonId/resources/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.getPreparedLessonResourceUpload.mockResolvedValue(session);
    dependencies.uploadPrivateR2Object.mockResolvedValue(undefined);
    dependencies.confirmLessonResourceUpload.mockResolvedValue(undefined);
    dependencies.markLessonResourceUploadUploaded.mockResolvedValue(undefined);
  });

  it("uploads, confirms and marks a prepared small file through the server", async () => {
    const file = new File(["pdf"], "material.pdf", { type: "application/pdf" });
    const response = await POST(createRequest({ file }), {
      params: Promise.resolve({ lessonId: "lesson-1" }),
    });

    expect(response.status).toBe(200);
    expect(dependencies.uploadPrivateR2Object).toHaveBeenCalledWith({
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
      key: reference.key,
    });
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

  it("rejects a file above the server fallback cap before contacting R2", async () => {
    const response = await POST(
      createRequest({
        file: new File([new Uint8Array(4 * 1024 * 1024 + 1)], "material.pdf", {
          type: "application/pdf",
        }),
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(413);
    expect(dependencies.uploadPrivateR2Object).not.toHaveBeenCalled();
  });

  it("rejects a missing or mismatched session", async () => {
    dependencies.getPreparedLessonResourceUpload.mockResolvedValue(null);

    const response = await POST(createRequest(), {
      params: Promise.resolve({ lessonId: "lesson-1" }),
    });

    expect(response.status).toBe(404);
    expect(dependencies.uploadPrivateR2Object).not.toHaveBeenCalled();
  });

  it("uploads and confirms a prepared preview together with the attachment", async () => {
    const previewReference = {
      ...reference,
      preview: {
        contentType: "image/webp" as const,
        height: 180,
        key: "lessons/lesson-1/resources/resource-1-preview.webp",
        sizeBytes: 7,
        width: 320,
      },
    };
    dependencies.getPreparedLessonResourceUpload.mockResolvedValue({
      ...session,
      reference: previewReference,
    });
    const formData = new FormData();
    const file = new File(["pdf"], "material.pdf", { type: "application/pdf" });
    const preview = new File(["preview"], "preview.webp", {
      type: "image/webp",
    });
    formData.set("file", file);
    formData.set("preview", preview);
    formData.set("resourceId", "resource-1");

    const response = await POST(
      new Request("https://app.example.test", {
        body: formData,
        method: "POST",
      }),
      { params: Promise.resolve({ lessonId: "lesson-1" }) }
    );

    expect(response.status).toBe(200);
    expect(dependencies.uploadPrivateR2Object).toHaveBeenCalledTimes(2);
    expect(dependencies.confirmLessonResourceUpload).toHaveBeenCalledTimes(2);
  });
});
