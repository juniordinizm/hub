const PRODUCTION_ONLY_SENTRY_VARIABLES = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_PROJECT_ID",
  "SENTRY_READINESS_ALERT_NAME",
  "SENTRY_READINESS_AUTH_TOKEN",
  "SENTRY_READINESS_SECRET",
  "NEXT_PUBLIC_SENTRY_DSN",
] as const;

type Environment = Readonly<Record<string, string | undefined>>;

export const getNonProductionSentryProblems = (
  environment: Environment,
  environmentName: string
): string[] =>
  PRODUCTION_ONLY_SENTRY_VARIABLES.flatMap((key) =>
    environment[key]?.trim()
      ? [`${key} must not be set in ${environmentName}`]
      : []
  );
