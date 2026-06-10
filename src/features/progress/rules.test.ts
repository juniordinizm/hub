import { describe, expect, it } from "vitest";
import {
  calculateCourseProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
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
});
