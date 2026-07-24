import { describe, expect, it } from "vitest";
import { resolveR2ClientEndpoint } from "./r2-endpoint";

describe("R2 client endpoint", () => {
  it("uses the Cloudflare endpoint outside E2E", () => {
    expect(
      resolveR2ClientEndpoint({
        accountId: "account-1",
        e2eTestMode: false,
      })
    ).toEqual({
      endpoint: "https://account-1.r2.cloudflarestorage.com",
      forcePathStyle: false,
    });
  });

  it("allows a loopback S3 endpoint only in E2E mode", () => {
    expect(
      resolveR2ClientEndpoint({
        accountId: "e2e",
        e2eTestMode: true,
        endpointOverride: "http://127.0.0.1:4568",
      })
    ).toEqual({
      endpoint: "http://127.0.0.1:4568",
      forcePathStyle: true,
    });
  });

  it("rejects endpoint overrides outside E2E and non-loopback targets", () => {
    expect(() =>
      resolveR2ClientEndpoint({
        accountId: "account-1",
        e2eTestMode: false,
        endpointOverride: "http://127.0.0.1:4568",
      })
    ).toThrow("E2E_TEST_MODE");
    expect(() =>
      resolveR2ClientEndpoint({
        accountId: "e2e",
        e2eTestMode: true,
        endpointOverride: "https://objects.example.test",
      })
    ).toThrow("loopback");
  });
});
