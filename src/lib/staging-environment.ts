const STAGING_ORIGIN = "https://preview.neurocapacitar.com.br";
const ASAAS_SANDBOX_ORIGIN = "https://api-sandbox.asaas.com";
const PRODUCTION_NEON_COMPUTE = "ep-hidden-tooth-ac843qc2";
const PRODUCTION_SENTRY_PROJECT_ID = "4511951566798848";
const APPROVED_JMVSTREAM_PLAN_ID = "OD-20912";
const DEVELOPMENT_PRIVATE_BUCKET = "hub-development-private";
const DEVELOPMENT_PUBLIC_BUCKET = "hub-development-public";
const STAGING_OBJECT_PREFIX = "staging";
const APPROVED_RESEND_DOMAIN = "neurocapacitar.com.br";
const MINIMUM_SECRET_LENGTH = 32;
const POOLED_HOST_MARKER = "-pooler.";
const LEADING_SLASHES = /^\/+/;
const DISPLAY_NAME_EMAIL = /<([^<>]+)>$/;
const PLACEHOLDER_VALUE = /^<[^<>]+>$/;

type Environment = Readonly<Record<string, string | undefined>>;

const hasValue = (environment: Environment, key: string): boolean =>
  Boolean(environment[key]?.trim());

const hasConfiguredValue = (environment: Environment, key: string): boolean => {
  const value = environment[key]?.trim();
  return Boolean(value && !PLACEHOLDER_VALUE.test(value));
};

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

  if (
    urls.some(
      (url) =>
        url &&
        (url.origin !== STAGING_ORIGIN ||
          url.pathname !== "/" ||
          Boolean(url.search || url.hash) ||
          Boolean(url.username || url.password))
    )
  ) {
    problems.push(
      "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must equal the Staging origin"
    );
  }
  return problems;
};

const getDatabaseProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  const expectedHost = environment.STAGING_DATABASE_HOST?.trim();
  const databaseUrl = readUrl(environment, "DATABASE_URL");

  if (!hasConfiguredValue(environment, "DATABASE_URL")) {
    problems.push("DATABASE_URL is required");
  } else if (
    databaseUrl &&
    ["postgres:", "postgresql:"].includes(databaseUrl.protocol)
  ) {
    const normalizedHost = normalizeNeonHost(databaseUrl.hostname);
    if (normalizedHost.startsWith(PRODUCTION_NEON_COMPUTE)) {
      problems.push("DATABASE_URL must not target the Production Neon compute");
    }
    if (expectedHost && normalizedHost !== normalizeNeonHost(expectedHost)) {
      problems.push("DATABASE_URL must target STAGING_DATABASE_HOST");
    }
  } else {
    problems.push("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!expectedHost) {
    problems.push("STAGING_DATABASE_HOST is required");
  } else if (
    normalizeNeonHost(expectedHost).startsWith(PRODUCTION_NEON_COMPUTE)
  ) {
    problems.push(
      "STAGING_DATABASE_HOST must not identify the Production Neon compute"
    );
  }
  return problems;
};

const getAsaasProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  for (const key of [
    "ASAAS_API_BASE_URL",
    "ASAAS_API_KEY",
    "ASAAS_USER_AGENT",
    "ASAAS_WEBHOOK_TOKEN",
  ] as const) {
    if (!hasConfiguredValue(environment, key)) {
      problems.push(`${key} is required`);
    }
  }

  const baseUrl = readUrl(environment, "ASAAS_API_BASE_URL");
  if (
    hasConfiguredValue(environment, "ASAAS_API_BASE_URL") &&
    (!baseUrl ||
      baseUrl.origin !== ASAAS_SANDBOX_ORIGIN ||
      baseUrl.pathname !== "/" ||
      Boolean(baseUrl.search || baseUrl.hash) ||
      Boolean(baseUrl.username || baseUrl.password))
  ) {
    problems.push(`ASAAS_API_BASE_URL must equal ${ASAAS_SANDBOX_ORIGIN}`);
  }

  const apiKey = environment.ASAAS_API_KEY?.trim();
  if (apiKey && !apiKey.startsWith("$aact_hmlg_")) {
    problems.push("ASAAS_API_KEY must be a Sandbox key");
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
  if (environment.R2_OBJECT_PREFIX?.trim() !== STAGING_OBJECT_PREFIX) {
    problems.push(`R2_OBJECT_PREFIX must equal ${STAGING_OBJECT_PREFIX}`);
  }
  for (const key of [
    "R2_ACCESS_KEY_ID",
    "R2_ACCOUNT_ID",
    "R2_PUBLIC_BASE_URL",
    "R2_SECRET_ACCESS_KEY",
  ] as const) {
    if (!hasConfiguredValue(environment, key)) {
      problems.push(`${key} is required`);
    }
  }
  if (environment.STAGING_R2_USES_DEVELOPMENT?.trim() !== "true") {
    problems.push("STAGING_R2_USES_DEVELOPMENT must equal true");
  }
  return problems;
};

const getSharedProviderProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  if (environment.JMVSTREAM_PLAN_ID?.trim() !== APPROVED_JMVSTREAM_PLAN_ID) {
    problems.push("JMVSTREAM_PLAN_ID must equal the approved Production plan");
  }
  if (
    !(
      hasConfiguredValue(environment, "JMVSTREAM_AUTH_RESOURCE") ||
      hasConfiguredValue(environment, "JMVSTREAM_API_TOKEN")
    )
  ) {
    problems.push("JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN is required");
  }
  if (environment.STAGING_JMVSTREAM_USES_PRODUCTION?.trim() !== "true") {
    problems.push("STAGING_JMVSTREAM_USES_PRODUCTION must equal true");
  }

  for (const key of [
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "SUPPORT_EMAIL",
  ] as const) {
    if (!hasConfiguredValue(environment, key)) {
      problems.push(`${key} is required`);
    }
  }
  if (!hasConfiguredValue(environment, "STAGING_EMAIL_RECIPIENT_ALLOWLIST")) {
    problems.push("STAGING_EMAIL_RECIPIENT_ALLOWLIST is required");
  }
  const sender = environment.RESEND_FROM_EMAIL?.trim().toLowerCase();
  const address = sender?.match(DISPLAY_NAME_EMAIL)?.[1] ?? sender;
  const senderDomain = address?.split("@").at(-1);
  if (sender && senderDomain !== APPROVED_RESEND_DOMAIN) {
    problems.push(`RESEND_FROM_EMAIL must use ${APPROVED_RESEND_DOMAIN}`);
  }
  if (environment.STAGING_RESEND_USES_PRODUCTION?.trim() !== "true") {
    problems.push("STAGING_RESEND_USES_PRODUCTION must equal true");
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
  const expectedProjectId = environment.STAGING_SENTRY_PROJECT_ID?.trim();
  if (!expectedProjectId) {
    problems.push("STAGING_SENTRY_PROJECT_ID is required");
  }

  for (const key of ["NEXT_PUBLIC_SENTRY_DSN", "SENTRY_DSN"] as const) {
    const projectId = readSentryProjectId(environment, key);
    if (!projectId) {
      problems.push(`${key} must be a valid Sentry DSN`);
      continue;
    }
    if (projectId === PRODUCTION_SENTRY_PROJECT_ID) {
      problems.push(`${key} must not target the Production project`);
    }
    if (expectedProjectId && projectId !== expectedProjectId) {
      problems.push(`${key} must target STAGING_SENTRY_PROJECT_ID`);
    }
  }
  return problems;
};

const getExplicitSwitchProblems = (environment: Environment): string[] => {
  const problems: string[] = [];
  if (environment.APPLICATION_MAINTENANCE_MODE?.trim() !== "off") {
    problems.push("APPLICATION_MAINTENANCE_MODE must equal off");
  }
  if (environment.AUTH_PUBLIC_SIGNUP_ENABLED?.trim() !== "true") {
    problems.push("AUTH_PUBLIC_SIGNUP_ENABLED must equal true");
  }

  const checkoutMode = environment.PAYMENTS_CHECKOUT_MODE?.trim();
  if (!checkoutMode) {
    problems.push("PAYMENTS_CHECKOUT_MODE is required");
  } else if (!["authenticated", "disabled", "public"].includes(checkoutMode)) {
    problems.push("PAYMENTS_CHECKOUT_MODE has an invalid value");
  }

  for (const key of [
    "ASAAS_WEBHOOK_ENABLED",
    "SCHEDULED_JOBS_ENABLED",
  ] as const) {
    const value = environment[key]?.trim();
    if (!value) {
      problems.push(`${key} is required`);
    } else if (!["false", "true"].includes(value)) {
      problems.push(`${key} must equal true or false`);
    }
  }
  return problems;
};

const getFirstPartySecretProblems = (environment: Environment): string[] =>
  (
    [
      "ASAAS_WEBHOOK_TOKEN",
      "BETTER_AUTH_SECRET",
      "CRON_SECRET",
      "HEALTHCHECK_SECRET",
    ] as const
  ).flatMap((key) => {
    if (!hasConfiguredValue(environment, key)) {
      return [`${key} is required`];
    }
    const length = environment[key]?.trim().length ?? 0;
    return length < MINIMUM_SECRET_LENGTH
      ? [`${key} must contain at least ${MINIMUM_SECRET_LENGTH} characters`]
      : [];
  });

const getForbiddenVariableProblems = (environment: Environment): string[] => {
  const webRuntimeOnly = [
    "DATABASE_URL_DIRECT",
    "CERTIFICATE_CONCURRENCY_DATABASE_URL",
  ] as const;
  const stagingForbidden = [
    "E2E_DATABASE_URL",
    "E2E_R2_BUCKET_NAME",
    "E2E_TEST_MODE",
    "INTERNAL_BOOTSTRAP_SECRET",
    "SMOKE_DATABASE_URL",
  ] as const;

  return [
    ...webRuntimeOnly.flatMap((key) =>
      hasValue(environment, key)
        ? [`${key} must not be set in the Staging web runtime`]
        : []
    ),
    ...stagingForbidden.flatMap((key) =>
      hasValue(environment, key) ? [`${key} must not be set in Staging`] : []
    ),
  ];
};

export const getStagingEnvironmentProblems = (
  environment: Environment
): string[] => {
  const problems = [
    ...getCanonicalOriginProblems(environment),
    ...getDatabaseProblems(environment),
    ...getAsaasProblems(environment),
    ...getR2Problems(environment),
    ...getSharedProviderProblems(environment),
    ...getSentryProblems(environment),
    ...getExplicitSwitchProblems(environment),
    ...getFirstPartySecretProblems(environment),
    ...getForbiddenVariableProblems(environment),
  ];

  if (environment.VERCEL_TARGET_ENV?.trim() !== "staging") {
    problems.push("VERCEL_TARGET_ENV must equal staging");
  }
  if (
    environment.CLIENT_IP_SOURCE?.trim().toLowerCase() !== "x-forwarded-for"
  ) {
    problems.push("CLIENT_IP_SOURCE must equal x-forwarded-for");
  }
  return [...new Set(problems)];
};
