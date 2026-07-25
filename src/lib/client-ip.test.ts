import { describe, expect, it } from "vitest";
import { getClientIpAddress } from "./client-ip";

describe("getClientIpAddress", () => {
  it("uses the first address supplied by the trusted reverse proxy", () => {
    expect(
      getClientIpAddress(
        new Headers({
          "x-forwarded-for": "203.0.113.10, 198.51.100.20",
          "x-real-ip": "198.51.100.20",
        }),
        "x-forwarded-for"
      )
    ).toBe("203.0.113.10");
  });

  it("uses Cloudflare's canonical address only in explicit Cloudflare mode", () => {
    const headers = new Headers({
      "cf-connecting-ip": "2001:db8::10",
      "x-forwarded-for": "203.0.113.10",
    });

    expect(getClientIpAddress(headers, "cloudflare")).toBe("2001:db8::10");
    expect(getClientIpAddress(headers, "x-forwarded-for")).toBe("203.0.113.10");
  });

  it("rejects malformed forwarded values", () => {
    expect(
      getClientIpAddress(
        new Headers({ "x-forwarded-for": "attacker-controlled" }),
        "x-forwarded-for"
      )
    ).toBe("unknown");
  });
});
