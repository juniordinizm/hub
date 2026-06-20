import { describe, expect, it } from "vitest";
import { isJmvstreamUploadProxyEnabled } from "./proxy-upload";

describe("JMVStream upload proxy policy", () => {
  it("enables the upload proxy during local development", () => {
    expect(
      isJmvstreamUploadProxyEnabled({
        isVercel: false,
        mode: "development",
        nodeEnv: "development",
      })
    ).toBe(true);
  });

  it("does not enable the upload proxy on Vercel", () => {
    expect(
      isJmvstreamUploadProxyEnabled({
        isVercel: true,
        mode: "enabled",
        nodeEnv: "production",
      })
    ).toBe(false);
  });
});
