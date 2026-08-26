import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  confirmStagedAdminImageUpload: vi.fn(),
  parseStagedAdminImageReference: vi.fn(),
  requireRole: vi.fn(),
  uploadStagedAdminImageFile: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  uploadStagedAdminImageFile: dependencies.uploadStagedAdminImageFile,
}));
vi.mock("@/features/storage/staged-image-upload", () => ({
  parseStagedAdminImageReference: dependencies.parseStagedAdminImageReference,
}));
vi.mock("@/features/storage/staged-image-upload-registry", () => ({
  confirmStagedAdminImageUpload: dependencies.confirmStagedAdminImageUpload,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import { POST } from "./route";

const reference = {
  aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
  contentType: "image/png",
  fileName: "capa.png",
  key: "uploads/admin-images/admin-1/course/c989d54d-d13f-46a1-89ed-2069d7c1c45b/course-cover/upload-capa.png",
  purpose: "course-cover" as const,
  sizeBytes: 4,
};

const createRequest = ({
  file = new File(["capa"], "capa.png", { type: "image/png" }),
  referenceValue = JSON.stringify(reference),
}: {
  file?: File | null;
  referenceValue?: string;
} = {}): Request => {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }
  formData.set("reference", referenceValue);
  return new Request(
    "https://hub.example.test/api/admin/uploads/images/upload",
    {
      body: formData,
      method: "POST",
    }
  );
};

describe("POST /api/admin/uploads/images/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.parseStagedAdminImageReference.mockReturnValue(reference);
    dependencies.uploadStagedAdminImageFile.mockResolvedValue(undefined);
    dependencies.confirmStagedAdminImageUpload.mockResolvedValue(undefined);
  });

  it("uploads and confirms a prepared file through the server", async () => {
    const file = new File(["capa"], "capa.png", { type: "image/png" });
    const response = await POST(createRequest({ file }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reference });
    expect(dependencies.uploadStagedAdminImageFile).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      file,
      reference,
    });
    expect(dependencies.confirmStagedAdminImageUpload).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      reference,
    });
  });

  it("rejects a missing file before contacting R2", async () => {
    const response = await POST(createRequest({ file: null }));

    expect(response.status).toBe(400);
    expect(dependencies.uploadStagedAdminImageFile).not.toHaveBeenCalled();
  });

  it("returns a sanitized R2 failure", async () => {
    dependencies.uploadStagedAdminImageFile.mockRejectedValue(
      new Error("provider credential detail")
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "provider credential detail",
    });
    expect(dependencies.confirmStagedAdminImageUpload).not.toHaveBeenCalled();
  });
});
