const REQUIRED_PREVIEW_VARIABLES = [
  "AUTH_PUBLIC_SIGNUP_ENABLED",
  "BETTER_AUTH_SECRET",
  "CLIENT_IP_SOURCE",
  "DATABASE_URL",
  "HEALTHCHECK_SECRET",
  "SCHEDULED_JOBS_ENABLED",
  "VERCEL_BRANCH_URL",
] as const;

const FORBIDDEN_PREVIEW_VARIABLES = [
  "ABACATEPAY_API_KEY",
  "ABACATEPAY_WEBHOOK_SECRET",
  "ABACATE_PAY_API_KEY",
  "BETTER_AUTH_URL",
  "CERTIFICATE_CONCURRENCY_DATABASE_URL",
  "CERTIFICATE_PUBLIC_BASE_URL",
  "CRON_SECRET",
  "DATABASE_URL_DIRECT",
  "E2E_DATABASE_URL",
  "E2E_R2_BUCKET_NAME",
  "E2E_TEST_MODE",
  "INTERNAL_BOOTSTRAP_SECRET",
  "JMVSTREAM_API_TOKEN",
  "JMVSTREAM_AUTH_RESOURCE",
  "JMVSTREAM_PLAN_ID",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SENTRY_DSN",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
  "R2_PUBLIC_BUCKET_NAME",
  "R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_DSN",
  "SMOKE_DATABASE_URL",
  "SUPPORT_EMAIL",
] as const;

const MINIMUM_SECRET_LENGTH = 32;

type Environment = Readonly<Record<string, string | undefined>>;

const hasValue = (environment: Environment, key: string): boolean =>
  Boolean(environment[key]?.trim());

const getDatabaseProblems = (environment: Environment): string[] => {
  const value = environment.DATABASE_URL?.trim();

  if (!value) {
    return [];
  }

  try {
    const protocol = new URL(value).protocol;

    if (protocol !== "postgres:" && protocol !== "postgresql:") {
      return ["DATABASE_URL must use the postgres or postgresql protocol"];
    }
  } catch {
    return ["DATABASE_URL must be a valid URL"];
  }

  return [];
};

const getSecretProblems = (environment: Environment): string[] =>
  (["BETTER_AUTH_SECRET", "HEALTHCHECK_SECRET"] as const).flatMap((key) => {
    const secretLength = environment[key]?.trim().length ?? 0;

    return secretLength > 0 && secretLength < MINIMUM_SECRET_LENGTH
      ? [`${key} must contain at least 32 characters`]
      : [];
  });

export const getPreviewEnvironmentProblems = (
  environment: Environment
): string[] => {
  const problems: string[] = REQUIRED_PREVIEW_VARIABLES.filter(
    (key) => !hasValue(environment, key)
  );

  for (const key of FORBIDDEN_PREVIEW_VARIABLES) {
    if (hasValue(environment, key)) {
      problems.push(`${key} must not be set in Preview`);
    }
  }

  if (environment.AUTH_PUBLIC_SIGNUP_ENABLED?.trim() !== "false") {
    problems.push("AUTH_PUBLIC_SIGNUP_ENABLED must equal false in Preview");
  }

  if (environment.CLIENT_IP_SOURCE?.trim() !== "x-forwarded-for") {
    problems.push("CLIENT_IP_SOURCE must equal x-forwarded-for in Preview");
  }

  if (environment.SCHEDULED_JOBS_ENABLED?.trim() !== "false") {
    problems.push("SCHEDULED_JOBS_ENABLED must equal false in Preview");
  }

  problems.push(
    ...getSecretProblems(environment),
    ...getDatabaseProblems(environment)
  );

  return [...new Set(problems)];
};
