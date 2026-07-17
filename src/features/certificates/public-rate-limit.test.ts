import { describe, expect, it } from "vitest";
import { getPublicCertificateRateLimitDecision } from "./public-rate-limit-policy";

describe("public certificate rate limit policy", () => {
  it("does not expose a different decision until the request limit is exceeded", () => {
    expect(getPublicCertificateRateLimitDecision({ requestCount: 20 })).toBe(
      "allowed"
    );
    expect(getPublicCertificateRateLimitDecision({ requestCount: 21 })).toBe(
      "limited"
    );
  });
});
