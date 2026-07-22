import { describe, expect, test } from "vitest";
import { getWatchCheckpointPercent, isLearningAnalyticsEnabled } from "./rules";

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

  test("keeps analytics enabled until the student explicitly opts out", () => {
    expect(isLearningAnalyticsEnabled({ disabledAt: null })).toBe(true);
    expect(
      isLearningAnalyticsEnabled({
        disabledAt: new Date("2026-07-22T12:00:00Z"),
      })
    ).toBe(false);
  });
});
