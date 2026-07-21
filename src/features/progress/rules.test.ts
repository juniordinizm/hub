import { describe, expect, it } from "vitest";
import {
  calculateCourseProgress,
  calculateVideoPositionProgress,
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

  it("calculates course completion from required lessons only", () => {
    expect(
      calculateCourseProgress({
        lessonIds: ["required-one", "optional", "required-two"],
        requiredLessonIds: ["required-one", "required-two"],
        completedLessonIds: ["required-one", "optional"],
      })
    ).toEqual({
      completedCount: 1,
      percent: 50,
      totalCount: 2,
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

  it("calculates watched percentage from the highest reached video position", () => {
    expect(
      calculateVideoPositionProgress({
        currentSeconds: 40,
        durationSeconds: 100,
        previousMaxPositionSeconds: 20,
      })
    ).toEqual({
      maxPositionSeconds: 40,
      watchedPercent: 40,
    });
  });

  it("keeps the highest reached position when the student watches the same part twice", () => {
    expect(
      calculateVideoPositionProgress({
        currentSeconds: 30,
        durationSeconds: 100,
        previousMaxPositionSeconds: 50,
      })
    ).toEqual({
      maxPositionSeconds: 50,
      watchedPercent: 50,
    });
  });
});
