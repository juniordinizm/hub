import { describe, expect, it } from "vitest";
import {
  assertStagedAdminImageOwnership,
  buildStagedAdminImageUpload,
} from "./staged-image-upload";

describe("staged admin image upload", () => {
  it("creates an actor-scoped private key for an allowed image", () => {
    expect(
      buildStagedAdminImageUpload({
        actorUserId: "user-1",
        aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
        contentType: "image/webp",
        fileName: "Capa final.webp",
        nonce: "upload-1",
        purpose: "course-cover",
        sizeBytes: 1024,
      })
    ).toEqual({
      aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
      contentType: "image/webp",
      fileName: "Capa final.webp",
      key: "uploads/admin-images/user-1/course/c989d54d-d13f-46a1-89ed-2069d7c1c45b/course-cover/upload-1-capa-final.webp",
      purpose: "course-cover",
      sizeBytes: 1024,
    });
  });

  it("rejects an image larger than the selected purpose allows", () => {
    expect(() =>
      buildStagedAdminImageUpload({
        actorUserId: "user-1",
        aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
        contentType: "image/png",
        fileName: "banner.png",
        nonce: "upload-1",
        purpose: "dashboard-banner",
        sizeBytes: 5 * 1024 * 1024 + 1,
      })
    ).toThrow("A imagem excede o limite permitido.");
  });

  it("rejects a reference owned by another actor or purpose", () => {
    const reference = buildStagedAdminImageUpload({
      actorUserId: "user-1",
      aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
      contentType: "image/jpeg",
      fileName: "assinatura.jpg",
      nonce: "upload-1",
      purpose: "certificate-signature",
      sizeBytes: 2048,
    });

    expect(() =>
      assertStagedAdminImageOwnership({
        actorUserId: "user-2",
        aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
        purpose: "certificate-signature",
        reference,
      })
    ).toThrow("Upload temporario invalido.");
    expect(() =>
      assertStagedAdminImageOwnership({
        actorUserId: "user-1",
        aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
        purpose: "certificate-background",
        reference,
      })
    ).toThrow("Upload temporario invalido.");
    expect(() =>
      assertStagedAdminImageOwnership({
        actorUserId: "user-1",
        aggregateId: "44feef7e-1b03-46c4-8119-ad22e5e57826",
        purpose: "certificate-signature",
        reference,
      })
    ).toThrow("Upload temporario invalido.");
  });
});
