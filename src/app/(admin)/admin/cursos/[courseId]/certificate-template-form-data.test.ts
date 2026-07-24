import { describe, expect, it } from "vitest";
import { applyCertificateTemplateFiles } from "./certificate-template-form-data";

describe("applyCertificateTemplateFiles", () => {
  it("includes selected files once and removes them after transient state is cleared", () => {
    const background = new File(["background"], "background.webp", {
      type: "image/webp",
    });
    const signature = new File(["signature"], "signature.webp", {
      type: "image/webp",
    });
    const first = new FormData();
    applyCertificateTemplateFiles(first, { background, signature });
    expect((first.get("background") as File).size).toBeGreaterThan(0);
    expect((first.get("signature") as File).size).toBeGreaterThan(0);

    const second = new FormData();
    second.set("background", background);
    second.set("signature", signature);
    applyCertificateTemplateFiles(second, {
      background: null,
      signature: null,
    });
    expect(second.has("background")).toBe(false);
    expect(second.has("signature")).toBe(false);
  });
});
