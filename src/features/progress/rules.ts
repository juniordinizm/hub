export interface CourseProgressInput {
  completedLessonIds: string[];
  lessonIds: string[];
  requiredLessonIds?: string[];
}

export interface CourseProgress {
  completedCount: number;
  percent: number;
  totalCount: number;
}

export interface VideoPositionProgressInput {
  currentSeconds: number;
  durationSeconds: number;
  previousMaxPositionSeconds: number;
}

export interface VideoPositionProgress {
  maxPositionSeconds: number;
  watchedPercent: number;
}

export const calculateCourseProgress = ({
  lessonIds,
  completedLessonIds,
  requiredLessonIds,
}: CourseProgressInput): CourseProgress => {
  const lessonIdSet = new Set(requiredLessonIds ?? lessonIds);
  const completedCount = new Set(
    completedLessonIds.filter((lessonId) => lessonIdSet.has(lessonId))
  ).size;
  const totalCount = lessonIdSet.size;

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

  let lastCompletedIndex = -1;
  for (let i = lessonIds.length - 1; i >= 0; i--) {
    const id = lessonIds[i];
    if (id !== undefined && completed.has(id)) {
      lastCompletedIndex = i;
      break;
    }
  }

  const targetIndex = lessonIds.indexOf(lessonId);
  if (targetIndex === -1) {
    return false;
  }

  if (targetIndex <= lastCompletedIndex) {
    return true;
  }

  if (targetIndex === lastCompletedIndex + 1) {
    return true;
  }

  return false;
};

export const calculateVideoPositionProgress = ({
  currentSeconds,
  durationSeconds,
  previousMaxPositionSeconds,
}: VideoPositionProgressInput): VideoPositionProgress => {
  const safeDurationSeconds = Math.max(1, Math.round(durationSeconds));
  const safeCurrentSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, Math.round(currentSeconds))
  );
  const safePreviousMaxPositionSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, Math.round(previousMaxPositionSeconds))
  );
  const maxPositionSeconds = Math.max(
    safeCurrentSeconds,
    safePreviousMaxPositionSeconds
  );

  return {
    maxPositionSeconds,
    watchedPercent: Math.min(
      100,
      Math.round((maxPositionSeconds / safeDurationSeconds) * 100)
    ),
  };
};
