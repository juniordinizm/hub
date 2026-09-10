import type {
  LearningAnalyticsKpis,
  LessonAnalyticsLessonReport,
  LessonAnalyticsLessonSummary,
  LessonAnalyticsMetric,
  LessonAnalyticsVersionMetric,
} from "./types";

const PUBLICATION_STATUS_ORDER = {
  published: 0,
  draft: 1,
  retired: 2,
} as const;

const compareCurrentLessons = (
  left: LessonAnalyticsMetric,
  right: LessonAnalyticsMetric
): number =>
  left.moduleSortOrder - right.moduleSortOrder ||
  left.lessonSortOrder - right.lessonSortOrder ||
  left.lessonTitle.localeCompare(right.lessonTitle, "pt-BR") ||
  left.lessonId.localeCompare(right.lessonId);

const toVersionMetric = (
  metric: LessonAnalyticsMetric
): LessonAnalyticsVersionMetric => ({
  activeEnrollments: metric.activeEnrollments,
  completed: metric.completed,
  errorCount: metric.errorCount,
  lessonTitle: metric.lessonTitle,
  medianCheckpointPercent: metric.medianCheckpointPercent,
  medianHoursToComplete: metric.medianHoursToComplete,
  medianHoursToNextLesson: metric.medianHoursToNextLesson,
  moduleTitle: metric.moduleTitle,
  publicationNumber: metric.publicationNumber,
  publicationStatus: metric.publicationStatus,
  started: metric.started,
});

const toAggregateMetric = (
  current: LessonAnalyticsMetric,
  versions: readonly LessonAnalyticsMetric[]
): LessonAnalyticsLessonSummary => ({
  activeEnrollments: current.activeEnrollments,
  completed: versions.reduce((total, version) => total + version.completed, 0),
  errorCount: versions.reduce(
    (total, version) => total + version.errorCount,
    0
  ),
  medianCheckpointPercent: current.aggregateMedianCheckpointPercent,
  medianHoursToComplete: current.aggregateMedianHoursToComplete,
  medianHoursToNextLesson: current.aggregateMedianHoursToNextLesson,
  started: versions.reduce((total, version) => total + version.started, 0),
});

const compareVersions = (
  left: LessonAnalyticsMetric,
  right: LessonAnalyticsMetric
): number =>
  right.publicationNumber - left.publicationNumber ||
  PUBLICATION_STATUS_ORDER[left.publicationStatus] -
    PUBLICATION_STATUS_ORDER[right.publicationStatus];

export const buildLessonAnalyticsLessonReports = (
  metrics: readonly LessonAnalyticsMetric[]
): LessonAnalyticsLessonReport[] => {
  const currentByCurriculumKey = new Map<string, LessonAnalyticsMetric>();
  const versionsByCurriculumKey = new Map<string, LessonAnalyticsMetric[]>();

  for (const metric of metrics) {
    if (metric.publicationStatus === "draft") {
      continue;
    }

    const versions = versionsByCurriculumKey.get(metric.curriculumKey) ?? [];
    versions.push(metric);
    versionsByCurriculumKey.set(metric.curriculumKey, versions);

    if (
      metric.publicationStatus === "published" &&
      !currentByCurriculumKey.has(metric.curriculumKey)
    ) {
      currentByCurriculumKey.set(metric.curriculumKey, metric);
    }
  }

  return [...currentByCurriculumKey.values()]
    .sort(compareCurrentLessons)
    .map((current, index) => {
      const versions = versionsByCurriculumKey.get(current.curriculumKey) ?? [];

      return {
        aggregate: toAggregateMetric(current, versions),
        courseAverageViewingPercent: current.courseAverageViewingPercent,
        current: toVersionMetric(current),
        curriculumKey: current.curriculumKey,
        lessonTitle: current.lessonTitle,
        moduleTitle: current.moduleTitle,
        position: index + 1,
        versions: versions.sort(compareVersions).map(toVersionMetric),
      };
    });
};

export const buildLearningAnalyticsKpis = (
  lessons: readonly LessonAnalyticsLessonReport[]
): LearningAnalyticsKpis => {
  const lessonsWithErrors = lessons.filter(
    (lesson) => lesson.aggregate.errorCount > 0
  );
  return {
    averageCourseViewingPercent:
      lessons[0]?.courseAverageViewingPercent ?? null,
    lessonCount: lessons.length,
    lessonsWithErrors: lessonsWithErrors.length,
    lessonsWithoutStarts: lessons.filter(
      (lesson) => lesson.aggregate.started === 0
    ).length,
  };
};

export const formatLearningAnalyticsHours = (value: number | null): string =>
  value === null ? "—" : `${value.toFixed(1)} h`;

export const formatLearningAnalyticsPercent = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value)}%`;
