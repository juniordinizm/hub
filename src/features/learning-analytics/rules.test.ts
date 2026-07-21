import { describe, expect, test } from "vitest";
import {
  getWatchCheckpointPercent,
  hasRecordedActivitySince,
  isActiveAnalyticsConsent,
} from "./rules";

describe("learning analytics rules", () => {
  test("emits only a newly crossed ten-percent checkpoint", () => {
    expect(
      getWatchCheckpointPercent({ previousPercent: 9, watchedPercent: 10 })
    ).toBe(10);
    expect(
      getWatchCheckpointPercent({ previousPercent: 10, watchedPercent: 19 })
    ).toBeNull();
    expect(
      getWatchCheckpointPercent({ previousPercent: 19, watchedPercent: 42 })
    ).toBe(40);
  });

  test("requires consent that has not been revoked", () => {
    const now = new Date();
    expect(
      isActiveAnalyticsConsent({ consentedAt: now, revokedAt: null })
    ).toBe(true);
    expect(isActiveAnalyticsConsent({ consentedAt: now, revokedAt: now })).toBe(
      false
    );
  });

  test("does not label absence of records as activity", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    expect(hasRecordedActivitySince({ lastActivityAt: null, now })).toBe(false);
    expect(
      hasRecordedActivitySince({
        lastActivityAt: new Date("2026-07-06T12:00:00Z"),
        now,
      })
    ).toBe(false);
    expect(
      hasRecordedActivitySince({
        lastActivityAt: new Date("2026-07-07T12:00:01Z"),
        now,
      })
    ).toBe(true);
  });
});
