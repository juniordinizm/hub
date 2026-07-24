export const LEARNING_ANALYTICS_POLICY_VERSION = "2026-07-22";

export const LEARNING_ANALYTICS_EVENT_TYPES = [
  "lesson_started",
  "watch_checkpoint",
  "lesson_completed",
  "resource_open_failed",
  "player_error",
] as const;

export type LearningAnalyticsEventType =
  (typeof LEARNING_ANALYTICS_EVENT_TYPES)[number];

export const getWatchCheckpointPercent = ({
  previousPercent,
  watchedPercent,
}: {
  previousPercent: number;
  watchedPercent: number;
}): number | null => {
  const checkpoint = Math.floor(watchedPercent / 10) * 10;
  return checkpoint >= 10 && checkpoint > previousPercent ? checkpoint : null;
};

export const isLearningAnalyticsEnabled = ({
  disabledAt,
}: {
  disabledAt: Date | null;
}): boolean => disabledAt === null;
