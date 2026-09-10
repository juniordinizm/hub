export const LEARNING_ANALYTICS_PERIODS = ["30d", "90d", "6m", "12m"] as const;

export type LearningAnalyticsPeriod =
  (typeof LEARNING_ANALYTICS_PERIODS)[number];

export const DEFAULT_LEARNING_ANALYTICS_PERIOD: LearningAnalyticsPeriod = "90d";

const LEARNING_ANALYTICS_PERIOD_LABELS: Record<
  LearningAnalyticsPeriod,
  string
> = {
  "12m": "12 meses",
  "30d": "1 mês",
  "90d": "3 meses",
  "6m": "6 meses",
};

export const isLearningAnalyticsPeriod = (
  value: string
): value is LearningAnalyticsPeriod =>
  (LEARNING_ANALYTICS_PERIODS as readonly string[]).includes(value);

export const parseLearningAnalyticsPeriod = (
  value: string | null | undefined
): LearningAnalyticsPeriod =>
  value && isLearningAnalyticsPeriod(value)
    ? value
    : DEFAULT_LEARNING_ANALYTICS_PERIOD;

export const getLearningAnalyticsPeriodLabel = (
  period: LearningAnalyticsPeriod
): string => LEARNING_ANALYTICS_PERIOD_LABELS[period];
