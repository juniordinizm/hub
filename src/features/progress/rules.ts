export interface CourseProgressInput {
  completedLessonIds: string[];
  lessonIds: string[];
}

export interface CourseProgress {
  completedCount: number;
  percent: number;
  totalCount: number;
}

export const calculateCourseProgress = ({
  lessonIds,
  completedLessonIds,
}: CourseProgressInput): CourseProgress => {
  const lessonIdSet = new Set(lessonIds);
  const completedCount = new Set(
    completedLessonIds.filter((lessonId) => lessonIdSet.has(lessonId))
  ).size;
  const totalCount = lessonIds.length;

  return {
    completedCount,
    totalCount,
    percent:
      totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
  };
};

export const getNextAvailableLessonId = ({
  lessonIds,
  completedLessonIds,
}: CourseProgressInput): string | null => {
  const completed = new Set(completedLessonIds);
  return lessonIds.find((lessonId) => !completed.has(lessonId)) ?? null;
};

export const isLessonAvailable = ({
  lessonIds,
  completedLessonIds,
  lessonId,
}: CourseProgressInput & {
  lessonId: string;
}): boolean => {
  const completed = new Set(completedLessonIds);

  if (completed.has(lessonId)) {
    return true;
  }

  return (
    getNextAvailableLessonId({ lessonIds, completedLessonIds }) === lessonId
  );
};
