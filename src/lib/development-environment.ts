const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const PRODUCTION_JMVSTREAM_PLAN_ID = "OD-20912";
const PRODUCTION_SENTRY_PROJECT_ID = "4511771125219328";
const DEVELOPMENT_PRIVATE_BUCKET = "hub-development-private";
const DEVELOPMENT_PUBLIC_BUCKET = "hub-development-public";
const APPROVED_RESEND_DOMAIN = "neurocapacitar.com.br";
const MINIMUM_SECRET_LENGTH = 32;
const POOLED_HOST_MARKER = "-pooler.";
const LEADING_SLASHES = /^\/+/;
const DISPLAY_NAME_EMAIL = /<([^<>]+)>$/;

type Environment = Readonly<Record<string, string | undefined>>;

const hasValue = (environment: Environment, key: string): boolean =>
  Boolean(environment[key]?.trim());

const readUrl = (environment: Environment, key: string): URL | null => {
  const value = environment[key]?.trim();
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeNeonHost = (host: string): string =>
  host.replace(POOLED_HOST_MARKER, ".");

const getDatabaseProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  const expectedHost = environment.DEVELOPMENT_DATABASE_HOST?.trim();

  for (const key of ["DATABASE_URL", "DATABASE_URL_DIRECT"] as const) {
    const url = readUrl(environment, key);
    if (!hasValue(environment, key)) {
      problems.push(`${key} is required`);
      continue;
    }
    if (!(url && ["postgres:", "postgresql:"].includes(url.protocol))) {
      problems.push(`${key} must be a valid PostgreSQL URL`);
      continue;
    }

    const normalizedHost = normalizeNeonHost(url.hostname);
    if (normalizedHost.startsWith(PRODUCTION_NEON_COMPUTE)) {
      problems.push(`${key} must not target the Production Neon compute`);
    }
    if (expectedHost && normalizedHost !== normalizeNeonHost(expectedHost)) {
      problems.push(`${key} must target DEVELOPMENT_DATABASE_HOST`);
    }
  }

  if (!expectedHost) {
    problems.push("DEVELOPMENT_DATABASE_HOST is required");
  }
  return problems;
};

const getCanonicalOriginProblems = (environment: Environment): string[] => {
  const keys = [
    "BETTER_AUTH_URL",
    "CERTIFICATE_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const urls = keys.map((key) => readUrl(environment, key));
  const problems = keys.flatMap((key, index) =>
    urls[index] ? [] : [`${key} must be a valid URL`]
  );

  if (urls.every((url): url is URL => Boolean(url))) {
    if (new Set(urls.map((url) => url.origin)).size !== 1) {
      problems.push(
        "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must use the same Development origin"
      );
    }

    const firstUrl = urls[0];
    if (!firstUrl) {
      return problems;
    }
    const { hostname, protocol } = firstUrl;
    const isLoopback = ["127.0.0.1", "::1", "[::1]", "localhost"].includes(
      hostname
    );
    if (!(isLoopback || protocol === "https:")) {
      problems.push(
        "Development application URLs must use loopback or an HTTPS origin"
      );
    }
  }
  return problems;
};

const getR2Problems = (environment: Environment): string[] => {
  const problems: string[] = [];
  if (environment.R2_BUCKET_NAME?.trim() !== DEVELOPMENT_PRIVATE_BUCKET) {
    problems.push(`R2_BUCKET_NAME must equal ${DEVELOPMENT_PRIVATE_BUCKET}`);
  }
  if (environment.R2_PUBLIC_BUCKET_NAME?.trim() !== DEVELOPMENT_PUBLIC_BUCKET) {
    problems.push(
      `R2_PUBLIC_BUCKET_NAME must equal ${DEVELOPMENT_PUBLIC_BUCKET}`
    );
  }
  for (const key of [
    "R2_ACCESS_KEY_ID",
    "R2_ACCOUNT_ID",
    "R2_PUBLIC_BASE_URL",
    "R2_SECRET_ACCESS_KEY",
  ] as const) {
    if (!hasValue(environment, key)) {
      problems.push(`${key} is required`);
    }
  }
  return problems;
};

const getResendProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  for (const key of [
    "DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SUPPORT_EMAIL",
  ] as const) {
    if (!hasValue(environment, key)) {
      problems.push(`${key} is required`);
    }
  }

  const sender = environment.RESEND_FROM_EMAIL?.trim().toLowerCase();
  const address = sender?.match(DISPLAY_NAME_EMAIL)?.[1] ?? sender;
  const senderDomain = address?.split("@").at(-1);
  if (sender && senderDomain !== APPROVED_RESEND_DOMAIN) {
    problems.push(`RESEND_FROM_EMAIL must use ${APPROVED_RESEND_DOMAIN}`);
  }
  return problems;
};

const getAbacatePayProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  if (
    environment.DEVELOPMENT_ABACATEPAY_DEV_MODE?.trim().toLowerCase() !== "true"
  ) {
    problems.push("DEVELOPMENT_ABACATEPAY_DEV_MODE must equal true");
  }
  if (
    !(
      hasValue(environment, "ABACATE_PAY_API_KEY") ||
      hasValue(environment, "ABACATEPAY_API_KEY")
    )
  ) {
    problems.push("ABACATE_PAY_API_KEY or ABACATEPAY_API_KEY is required");
  }
  if (!hasValue(environment, "ABACATEPAY_WEBHOOK_SECRET")) {
    problems.push("ABACATEPAY_WEBHOOK_SECRET is required");
  }
  return problems;
};

const getJmvstreamProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  const planId = environment.JMVSTREAM_PLAN_ID?.trim();
  const expectedPlanId = environment.DEVELOPMENT_JMVSTREAM_PLAN_ID?.trim();

  if (!expectedPlanId) {
    problems.push("DEVELOPMENT_JMVSTREAM_PLAN_ID is required");
  }
  if (planId) {
    if (planId === PRODUCTION_JMVSTREAM_PLAN_ID) {
      problems.push("JMVSTREAM_PLAN_ID must not target the Production plan");
    }
    if (expectedPlanId && planId !== expectedPlanId) {
      problems.push(
        "JMVSTREAM_PLAN_ID must equal DEVELOPMENT_JMVSTREAM_PLAN_ID"
      );
    }
  } else {
    problems.push("JMVSTREAM_PLAN_ID is required");
  }
  if (
    !(
      hasValue(environment, "JMVSTREAM_AUTH_RESOURCE") ||
      hasValue(environment, "JMVSTREAM_API_TOKEN")
    )
  ) {
    problems.push("JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN is required");
  }
  return problems;
};

const readSentryProjectId = (
  environment: Environment,
  key: "NEXT_PUBLIC_SENTRY_DSN" | "SENTRY_DSN"
): string | null => {
  const url = readUrl(environment, key);
  return url?.pathname.replace(LEADING_SLASHES, "") || null;
};

const getSentryProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  const expectedProjectId = environment.DEVELOPMENT_SENTRY_PROJECT_ID?.trim();
  if (!expectedProjectId) {
    problems.push("DEVELOPMENT_SENTRY_PROJECT_ID is required");
  }

  for (const key of ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const) {
    const projectId = readSentryProjectId(environment, key);
    if (!projectId) {
      problems.push(`${key} must be a valid Sentry DSN`);
      continue;
    }
    if (projectId === PRODUCTION_SENTRY_PROJECT_ID) {
      problems.push(`${key} must not target the Production project`);
    }
    if (expectedProjectId && projectId !== expectedProjectId) {
      problems.push(`${key} must target DEVELOPMENT_SENTRY_PROJECT_ID`);
    }
  }
  return problems;
};

const getFirstPartySecretProblems = (environment: Environment): string[] =>
  (
    ["BETTER_AUTH_SECRET", "CRON_SECRET", "HEALTHCHECK_SECRET"] as const
  ).flatMap((key) => {
    const length = environment[key]?.trim().length ?? 0;
    if (length === 0) {
      return [`${key} is required`];
    }
    return length < MINIMUM_SECRET_LENGTH
      ? [`${key} must contain at least ${MINIMUM_SECRET_LENGTH} characters`]
      : [];
  });

const getIsolatedE2eProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  if (environment.CI?.trim().toLowerCase() !== "true") {
    problems.push("E2E_TEST_MODE requires CI=true");
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  const e2eDatabaseUrl = environment.E2E_DATABASE_URL?.trim();
  if (!(databaseUrl && e2eDatabaseUrl)) {
    problems.push("DATABASE_URL and E2E_DATABASE_URL are required for E2E");
  } else if (databaseUrl !== e2eDatabaseUrl) {
    problems.push("DATABASE_URL must exactly match E2E_DATABASE_URL");
  }

  const parsedE2eDatabaseUrl = readUrl(environment, "E2E_DATABASE_URL");
  if (!parsedE2eDatabaseUrl) {
    problems.push("E2E_DATABASE_URL must be a valid PostgreSQL URL");
  } else if (
    normalizeNeonHost(parsedE2eDatabaseUrl.hostname).startsWith(
      PRODUCTION_NEON_COMPUTE
    )
  ) {
    problems.push(
      "E2E_DATABASE_URL must not target the Production Neon compute"
    );
  }

  if (
    !environment.E2E_R2_BUCKET_NAME?.trim() ||
    environment.E2E_R2_BUCKET_NAME.trim() !== environment.R2_BUCKET_NAME?.trim()
  ) {
    problems.push("E2E_R2_BUCKET_NAME must exactly match R2_BUCKET_NAME");
  }

  const r2Endpoint = readUrl(environment, "R2_ENDPOINT");
  if (
    r2Endpoint?.protocol !== "http:" ||
    !["127.0.0.1", "::1", "[::1]", "localhost"].includes(
      r2Endpoint?.hostname ?? ""
    )
  ) {
    problems.push("R2_ENDPOINT must use HTTP loopback in E2E");
  }
  return problems;
};

export const getDevelopmentEnvironmentProblems = (
  environment: Environment
): string[] => {
  if (environment.E2E_TEST_MODE?.trim().toLowerCase() === "true") {
    return [...new Set(getIsolatedE2eProblems(environment))];
  }

  const problems = [
    ...getDatabaseProblems(environment),
    ...getCanonicalOriginProblems(environment),
    ...getR2Problems(environment),
    ...getResendProblems(environment),
    ...getAbacatePayProblems(environment),
    ...getJmvstreamProblems(environment),
    ...getSentryProblems(environment),
    ...getFirstPartySecretProblems(environment),
  ];

  if (environment.E2E_TEST_MODE?.trim().toLowerCase() !== "false") {
    problems.push("E2E_TEST_MODE must equal false");
  }
  if (environment.SCHEDULED_JOBS_ENABLED?.trim().toLowerCase() !== "true") {
    problems.push("SCHEDULED_JOBS_ENABLED must equal true");
  }
  for (const key of [
    "VERCEL",
    "VERCEL_BRANCH_URL",
    "VERCEL_ENV",
    "VERCEL_URL",
  ] as const) {
    if (hasValue(environment, key)) {
      problems.push(`${key} must not be set in local Development`);
    }
  }
  return [...new Set(problems)];
};
