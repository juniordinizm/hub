import { describe, expect, it } from "vitest";
import { applyCertificateTemplateUploads } from "./certificate-template-form-data";

describe("applyCertificateTemplateUploads", () => {
  it("submits only staged references and removes file payloads", () => {
    const background = {
      aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
      contentType: "image/webp",
      fileName: "background.webp",
      key: "uploads/admin-images/user-1/certificate-template/c989d54d-d13f-46a1-89ed-2069d7c1c45b/certificate-background/bg",
      purpose: "certificate-background" as const,
      sizeBytes: 1024,
    };
    const signature = {
      aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
      contentType: "image/webp",
      fileName: "signature.webp",
      key: "uploads/admin-images/user-1/certificate-template/c989d54d-d13f-46a1-89ed-2069d7c1c45b/certificate-signature/signature",
      purpose: "certificate-signature" as const,
      sizeBytes: 512,
    };
    const first = new FormData();
    first.set(
      "background",
      new File(["background"], "background.webp", { type: "image/webp" })
    );
    applyCertificateTemplateUploads(first, { background, signature });
    expect(first.has("background")).toBe(false);
    expect(JSON.parse(String(first.get("backgroundUpload")))).toEqual(
      background
    );
    expect(JSON.parse(String(first.get("signatureUpload")))).toEqual(signature);

    const second = new FormData();
    second.set("backgroundUpload", JSON.stringify(background));
    second.set("signatureUpload", JSON.stringify(signature));
    applyCertificateTemplateUploads(second, {
      background: null,
      signature: null,
    });
    expect(second.has("backgroundUpload")).toBe(false);
    expect(second.has("signatureUpload")).toBe(false);
  });
});
