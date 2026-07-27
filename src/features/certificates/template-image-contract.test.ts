import { describe, expect, it } from "vitest";
import {
  MAX_CERTIFICATE_BACKGROUND_BYTES,
  MAX_CERTIFICATE_SIGNATURE_BYTES,
  validateCertificateImageFile,
} from "./template-image-contract";

const image = (size: number, type = "image/png"): File =>
  new File([new Uint8Array(size)], "imagem.png", { type });

describe("validateCertificateImageFile", () => {
  it("uses the background limit from the shared contract", () => {
    expect(() =>
      validateCertificateImageFile(
        image(MAX_CERTIFICATE_BACKGROUND_BYTES),
        "background"
      )
    ).not.toThrow();
    expect(() =>
      validateCertificateImageFile(
        image(MAX_CERTIFICATE_BACKGROUND_BYTES + 1),
        "background"
      )
    ).toThrow("10 MB");
  });

  it("uses the signature limit from the shared contract", () => {
    expect(() =>
      validateCertificateImageFile(
        image(MAX_CERTIFICATE_SIGNATURE_BYTES),
        "signature"
      )
    ).not.toThrow();
    expect(() =>
      validateCertificateImageFile(
        image(MAX_CERTIFICATE_SIGNATURE_BYTES + 1),
        "signature"
      )
    ).toThrow("2 MB");
  });

  it("rejects unsupported MIME types", () => {
    expect(() =>
      validateCertificateImageFile(image(1, "image/gif"), "background")
    ).toThrow("JPG, PNG ou WebP");
  });
});
