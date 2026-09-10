import type { LearningAnalyticsPeriod } from "./period";

export type { LearningAnalyticsPeriod } from "./period";

export type LessonAnalyticsPublicationStatus =
  | "draft"
  | "published"
  | "retired";

export interface LessonAnalyticsMetric {
  activeEnrollments: number;
  aggregateMedianCheckpointPercent: number | null;
  aggregateMedianHoursToComplete: number | null;
  aggregateMedianHoursToNextLesson: number | null;
  completed: number;
  courseAverageViewingPercent: number | null;
  courseId: string;
  coursePublicationId: string;
  courseTitle: string;
  curriculumKey: string;
  errorCount: number;
  lessonId: string;
  lessonSortOrder: number;
  lessonTitle: string;
  medianCheckpointPercent: number | null;
  medianHoursToComplete: number | null;
  medianHoursToNextLesson: number | null;
  moduleSortOrder: number;
  moduleTitle: string;
  publicationNumber: number;
  publicationStatus: LessonAnalyticsPublicationStatus;
  started: number;
}

export interface LessonAnalyticsVersionMetric {
  activeEnrollments: number;
  completed: number;
  errorCount: number;
  lessonTitle: string;
  medianCheckpointPercent: number | null;
  medianHoursToComplete: number | null;
  medianHoursToNextLesson: number | null;
  moduleTitle: string;
  publicationNumber: number;
  publicationStatus: LessonAnalyticsPublicationStatus;
  started: number;
}

export interface LessonAnalyticsLessonSummary {
  activeEnrollments: number;
  completed: number;
  errorCount: number;
  medianCheckpointPercent: number | null;
  medianHoursToComplete: number | null;
  medianHoursToNextLesson: number | null;
  started: number;
}

export interface LessonAnalyticsLessonReport {
  aggregate: LessonAnalyticsLessonSummary;
  courseAverageViewingPercent: number | null;
  current: LessonAnalyticsVersionMetric;
  curriculumKey: string;
  lessonTitle: string;
  moduleTitle: string;
  position: number;
  versions: LessonAnalyticsVersionMetric[];
}

export interface LearningAnalyticsKpis {
  averageCourseViewingPercent: number | null;
  lessonCount: number;
  lessonsWithErrors: number;
  lessonsWithoutStarts: number;
}

export interface LearningAnalyticsCourseOption {
  id: string;
  lessonCount: number;
  publicationNumber: number;
  title: string;
}

export interface LessonAnalyticsMetricPage {
  hasNextPage: boolean;
  metrics: LessonAnalyticsMetric[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface LessonAnalyticsMetricQuery {
  courseId?: string;
  page?: number;
  pageSize?: number;
  period?: LearningAnalyticsPeriod;
}
