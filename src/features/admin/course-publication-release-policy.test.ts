import { describe, expect, it } from "vitest";
import {
  findContentReleaseRegressions,
  type PublishedLessonRelease,
} from "./course-publication-release-policy";

const immediateLesson: PublishedLessonRelease = {
  curriculumKey: "lesson-immediate",
  lessonTitle: "Introdução",
  moduleTitle: "Comece aqui",
  releaseDelayDays: 0,
};
const delayedLesson: PublishedLessonRelease = {
  curriculumKey: "lesson-delayed",
  lessonTitle: "Prática",
  moduleTitle: "Aprofundamento",
  releaseDelayDays: 8,
};
const previous: PublishedLessonRelease[] = [immediateLesson, delayedLesson];

describe("course publication release policy", () => {
  it("allows unchanged or reduced delays after scheduled release history", () => {
    expect(
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: true,
        previous,
        next: [
          { ...immediateLesson },
          { ...delayedLesson, releaseDelayDays: 0 },
        ],
      })
    ).toEqual([]);
    expect(
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: true,
        previous,
        next: [{ ...delayedLesson }],
      })
    ).toEqual([]);
  });

  it("reports delay increases and moves to more restrictive modules", () => {
    expect(
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: true,
        previous,
        next: [
          {
            ...immediateLesson,
            moduleTitle: "Conteúdo futuro",
            releaseDelayDays: 8,
          },
        ],
      })
    ).toEqual([
      {
        curriculumKey: "lesson-immediate",
        lessonTitle: "Introdução",
        nextDelayDays: 8,
        nextModuleTitle: "Conteúdo futuro",
        previousDelayDays: 0,
      },
    ]);
  });

  it("allows new curriculum keys at any delay", () => {
    expect(
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: true,
        previous,
        next: [
          {
            curriculumKey: "new-lesson",
            lessonTitle: "Bônus",
            moduleTitle: "Bônus futuro",
            releaseDelayDays: 30,
          },
        ],
      })
    ).toEqual([]);
  });

  it("allows any change before scheduled release history exists", () => {
    expect(
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: false,
        previous,
        next: [{ ...immediateLesson, releaseDelayDays: 30 }],
      })
    ).toEqual([]);
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid release delays %j", (releaseDelayDays) => {
    expect(() =>
      findContentReleaseRegressions({
        hasScheduledReleaseHistory: false,
        previous,
        next: [{ ...immediateLesson, releaseDelayDays }],
      })
    ).toThrow("Atraso de liberação inválido.");
  });
});
