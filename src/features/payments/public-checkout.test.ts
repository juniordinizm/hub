import { describe, expect, it } from "vitest";
import {
  getPublicCheckoutRateLimitDecision,
  normalizeBuyerEmail,
} from "./public-checkout-policy";

describe("public course checkout", () => {
  it("normalizes buyer emails before identity matching", () => {
    expect(normalizeBuyerEmail("  ALUNA@Example.COM ")).toBe(
      "aluna@example.com"
    );
  });

  it("rate-limits repeated public checkout attempts per course and IP", () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const state = new Map<string, { count: number; resetAt: number }>();

    for (let index = 0; index < 5; index += 1) {
      expect(
        getPublicCheckoutRateLimitDecision({
          courseKey: "course_123",
          ipAddress: "203.0.113.10",
          now,
          state,
        })
      ).toMatchObject({ allowed: true });
    }

    expect(
      getPublicCheckoutRateLimitDecision({
        courseKey: "course_123",
        ipAddress: "203.0.113.10",
        now,
        state,
      })
    ).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });
});
