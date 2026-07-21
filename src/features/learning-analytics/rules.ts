export const LEARNING_ANALYTICS_POLICY_VERSION = "2026-07-21";
export const LEARNING_ACTIVITY_INACTIVE_DAYS = 14;
export const LEARNING_REENGAGEMENT_COOLDOWN_DAYS = 30;
export const LEARNING_ANALYTICS_RAW_RETENTION_DAYS = 90;

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

export const isActiveAnalyticsConsent = ({
  consentedAt,
  revokedAt,
}: {
  consentedAt: Date | null;
  revokedAt: Date | null;
}): boolean => Boolean(consentedAt && !revokedAt);

export const hasRecordedActivitySince = ({
  lastActivityAt,
  now,
}: {
  lastActivityAt: Date | null;
  now: Date;
}): boolean => {
  if (!lastActivityAt) {
    return false;
  }
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - LEARNING_ACTIVITY_INACTIVE_DAYS);
  return lastActivityAt >= cutoff;
};
