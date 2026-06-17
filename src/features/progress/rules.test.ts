import { describe, expect, it } from "vitest";
import {
  calculateCourseProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
  mergeWatchedRange,
} from "./rules";

const lessonIds = ["l1", "l2", "l3", "l4"] as const;

describe("course progress rules", () => {
  it("calculates completion percentage from unique completed lessons", () => {
    expect(
      calculateCourseProgress({
        lessonIds: [...lessonIds],
        completedLessonIds: ["l1", "l1", "l3"],
      })
    ).toEqual({
      completedCount: 2,
      totalCount: 4,
      percent: 50,
    });
  });

  it("allows only the first incomplete lesson in sequence", () => {
    const completedLessonIds = ["l1"];

    expect(
      isLessonAvailable({
        lessonIds: [...lessonIds],
        completedLessonIds,
        lessonId: "l1",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: [...lessonIds],
        completedLessonIds,
        lessonId: "l2",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: [...lessonIds],
        completedLessonIds,
        lessonId: "l3",
      })
    ).toBe(false);
  });

  it("returns the next available lesson after the last completed lesson", () => {
    expect(
      getNextAvailableLessonId({
        lessonIds: [...lessonIds],
        completedLessonIds: ["l1", "l2"],
      })
    ).toBe("l3");
  });

  it("merges watched ranges and returns the watched percentage", () => {
    expect(
      mergeWatchedRange({
        currentSeconds: 40,
        durationSeconds: 100,
        existingRanges: [
          [0, 20],
          [18, 30],
        ],
      })
    ).toEqual({
      ranges: [[0, 40]],
      watchedPercent: 40,
    });
  });

  it("does not count skipped video gaps as watched time", () => {
    expect(
      mergeWatchedRange({
        currentSeconds: 90,
        durationSeconds: 100,
        existingRanges: [[0, 10]],
        maxTrackedGapSeconds: 20,
        startSeconds: 10,
      })
    ).toEqual({
      ranges: [[0, 10]],
      watchedPercent: 10,
    });
  });
});
