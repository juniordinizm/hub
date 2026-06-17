export interface CourseProgressInput {
  completedLessonIds: string[];
  lessonIds: string[];
}

export interface CourseProgress {
  completedCount: number;
  percent: number;
  totalCount: number;
}

export type WatchedRange = [number, number];

export interface MergeWatchedRangeInput {
  currentSeconds: number;
  durationSeconds: number;
  existingRanges: WatchedRange[];
  maxTrackedGapSeconds?: number;
  startSeconds?: number;
}

export interface MergeWatchedRangeResult {
  ranges: WatchedRange[];
  watchedPercent: number;
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

export const mergeWatchedRange = ({
  currentSeconds,
  durationSeconds,
  existingRanges,
  maxTrackedGapSeconds,
  startSeconds = 0,
}: MergeWatchedRangeInput): MergeWatchedRangeResult => {
  const safeDurationSeconds = Math.max(1, Math.round(durationSeconds));
  const safeStartSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, Math.round(startSeconds))
  );
  const endSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, Math.round(currentSeconds))
  );
  const watchedGapSeconds = endSeconds - safeStartSeconds;
  const shouldTrackCurrentRange =
    watchedGapSeconds > 0 &&
    (!maxTrackedGapSeconds || watchedGapSeconds <= maxTrackedGapSeconds);
  const ranges = [
    ...existingRanges,
    ...(shouldTrackCurrentRange
      ? ([[safeStartSeconds, endSeconds]] satisfies WatchedRange[])
      : []),
  ]
    .map(
      ([start, end]) =>
        [
          Math.max(0, Math.min(safeDurationSeconds, Math.round(start))),
          Math.max(0, Math.min(safeDurationSeconds, Math.round(end))),
        ] satisfies WatchedRange
    )
    .filter(([start, end]) => end > start)
    .sort(([firstStart], [secondStart]) => firstStart - secondStart);
  const mergedRanges: WatchedRange[] = [];

  for (const range of ranges) {
    const previousRange = mergedRanges.at(-1);

    if (!previousRange || range[0] > previousRange[1]) {
      mergedRanges.push(range);
      continue;
    }

    previousRange[1] = Math.max(previousRange[1], range[1]);
  }

  const watchedSeconds = mergedRanges.reduce(
    (total, [start, end]) => total + (end - start),
    0
  );

  return {
    ranges: mergedRanges,
    watchedPercent: Math.min(
      100,
      Math.round((watchedSeconds / safeDurationSeconds) * 100)
    ),
  };
};
