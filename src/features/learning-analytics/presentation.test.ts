import { describe, expect, it } from "vitest";
import {
  buildLearningAnalyticsKpis,
  buildLessonAnalyticsLessonReports,
} from "./presentation";
import type { LessonAnalyticsMetric } from "./types";

const metric = (
  overrides: Partial<LessonAnalyticsMetric> = {}
): LessonAnalyticsMetric => ({
  activeEnrollments: 10,
  completed: 4,
  courseId: "course-1",
  coursePublicationId: "publication-2",
  courseTitle: "Curso",
  courseAverageViewingPercent: 62.5,
  curriculumKey: "curriculum-1",
  errorCount: 0,
  lessonId: "lesson-1-v2",
  lessonSortOrder: 1,
  lessonTitle: "Aula 1",
  medianCheckpointPercent: 50,
  medianHoursToComplete: 2,
  medianHoursToNextLesson: 1,
  moduleSortOrder: 1,
  moduleTitle: "Módulo 1",
  publicationNumber: 2,
  publicationStatus: "published",
  started: 6,
  aggregateMedianCheckpointPercent: 50,
  aggregateMedianHoursToComplete: 2,
  aggregateMedianHoursToNextLesson: 1,
  ...overrides,
});

describe("learning analytics presentation", () => {
  it("orders published lessons and ignores draft versions", () => {
    const reports = buildLessonAnalyticsLessonReports([
      metric({
        curriculumKey: "curriculum-1",
        lessonId: "lesson-1-v3",
        lessonTitle: "Primeira aula em edição",
        publicationNumber: 3,
        publicationStatus: "draft",
      }),
      metric({
        curriculumKey: "curriculum-2",
        lessonId: "lesson-2-v2",
        lessonSortOrder: 2,
        lessonTitle: "Aula 2",
      }),
      metric({
        curriculumKey: "curriculum-1",
        lessonId: "lesson-1-v1",
        lessonTitle: "Aula 1 antiga",
        publicationNumber: 1,
        publicationStatus: "retired",
      }),
      metric(),
    ]);

    expect(reports.map((report) => report.lessonTitle)).toEqual([
      "Aula 1",
      "Aula 2",
    ]);
    expect(reports[0]?.position).toBe(1);
    expect(reports[0]?.aggregate.started).toBe(12);
    expect(reports[0]?.aggregate.errorCount).toBe(0);
    expect(reports[0]?.aggregate.medianCheckpointPercent).toBe(50);
    expect(
      reports[0]?.versions.map((version) => version.publicationNumber)
    ).toEqual([2, 1]);
    expect(reports[0]?.versions[1]?.lessonTitle).toBe("Aula 1 antiga");
  });

  it("ranks KPIs using the combined metrics from every version", () => {
    const reports = buildLessonAnalyticsLessonReports([
      metric({
        curriculumKey: "curriculum-1",
        lessonId: "lesson-1-v2",
        medianHoursToComplete: 4,
        aggregateMedianHoursToComplete: 4,
      }),
      metric({
        curriculumKey: "curriculum-2",
        errorCount: 5,
        lessonId: "lesson-2-v2",
        lessonSortOrder: 2,
        lessonTitle: "Aula 2",
        medianHoursToComplete: 1,
        aggregateMedianHoursToComplete: 1,
      }),
      metric({
        curriculumKey: "curriculum-1",
        errorCount: 20,
        lessonId: "lesson-1-v1",
        lessonTitle: "Aula 1 antiga",
        medianHoursToComplete: 0.5,
        publicationNumber: 1,
        publicationStatus: "retired",
        aggregateMedianHoursToComplete: 4,
      }),
    ]);

    expect(buildLearningAnalyticsKpis(reports)).toEqual({
      averageCourseViewingPercent: 62.5,
      lessonCount: 2,
      lessonsWithErrors: 2,
      lessonsWithoutStarts: 0,
    });
  });
});
