const REQUIRED_PRODUCTION_VARIABLES = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CERTIFICATE_PUBLIC_BASE_URL",
  "CRON_SECRET",
  "DATABASE_URL",
  "HEALTHCHECK_SECRET",
  "JMVSTREAM_PLAN_ID",
  "NEXT_PUBLIC_APP_URL",
  "PAYMENTS_CHECKOUT_MODE",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
  "R2_PUBLIC_BUCKET_NAME",
  "R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SCHEDULED_JOBS_ENABLED",
  "SUPPORT_EMAIL",
] as const;

const REQUIRED_PRODUCTION_ALTERNATIVES = [
  {
    keys: ["JMVSTREAM_AUTH_RESOURCE", "JMVSTREAM_API_TOKEN"],
    label: "JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN",
  },
] as const;

const HTTPS_PRODUCTION_VARIABLES = [
  "BETTER_AUTH_URL",
  "CERTIFICATE_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "R2_PUBLIC_BASE_URL",
] as const;

const FIRST_PARTY_SECRET_VARIABLES = [
  "BETTER_AUTH_SECRET",
  "CRON_SECRET",
  "HEALTHCHECK_SECRET",
  "ASAAS_WEBHOOK_TOKEN",
] as const;

const ASAAS_PRODUCTION_VARIABLES = [
  "ASAAS_API_BASE_URL",
  "ASAAS_API_KEY",
  "ASAAS_USER_AGENT",
  "ASAAS_WEBHOOK_ENABLED",
  "ASAAS_WEBHOOK_TOKEN",
] as const;

const MINIMUM_SECRET_LENGTH = 32;
const ASAAS_PRODUCTION_ORIGIN = "https://api.asaas.com";
const PAYMENTS_CHECKOUT_MODES = new Set([
  "authenticated",
  "disabled",
  "public",
]);

const hasValue = (
  environment: Readonly<Record<string, string | undefined>>,
  key: string
): boolean => Boolean(environment[key]?.trim());

const getParsedUrl = (
  environment: Readonly<Record<string, string | undefined>>,
  key: string
): URL | null => {
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

const getUrlProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] => {
  const problems: string[] = [];

  for (const key of HTTPS_PRODUCTION_VARIABLES) {
    const url = getParsedUrl(environment, key);

    if (hasValue(environment, key) && !url) {
      problems.push(`${key} must be a valid URL`);
    } else if (url && url.protocol !== "https:") {
      problems.push(`${key} must use https`);
    }
  }

  return problems;
};

const getSecretProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] =>
  FIRST_PARTY_SECRET_VARIABLES.flatMap((key) => {
    const secretLength = environment[key]?.trim().length ?? 0;

    if (secretLength > 0 && secretLength < MINIMUM_SECRET_LENGTH) {
      return [`${key} must contain at least 32 characters`];
    }

    return [];
  });

const getCheckoutModeProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] =>
  hasValue(environment, "PAYMENTS_CHECKOUT_MODE") &&
  !PAYMENTS_CHECKOUT_MODES.has(environment.PAYMENTS_CHECKOUT_MODE?.trim() ?? "")
    ? ["PAYMENTS_CHECKOUT_MODE is invalid"]
    : [];

const getAsaasWebhookSwitchProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] =>
  hasValue(environment, "ASAAS_WEBHOOK_ENABLED") &&
  !["false", "true"].includes(environment.ASAAS_WEBHOOK_ENABLED?.trim() ?? "")
    ? ["ASAAS_WEBHOOK_ENABLED must equal true or false"]
    : [];

const requiresAsaasCapability = (
  environment: Readonly<Record<string, string | undefined>>
): boolean =>
  ["authenticated", "public"].includes(
    environment.PAYMENTS_CHECKOUT_MODE?.trim() ?? ""
  ) || environment.ASAAS_WEBHOOK_ENABLED?.trim() === "true";

export const getProductionEnvironmentProblems = (
  environment: Readonly<Record<string, string | undefined>>
): string[] => {
  const problems: string[] = REQUIRED_PRODUCTION_VARIABLES.filter(
    (key) => !hasValue(environment, key)
  );

  for (const requirement of REQUIRED_PRODUCTION_ALTERNATIVES) {
    if (!requirement.keys.some((key) => hasValue(environment, key))) {
      problems.push(requirement.label);
    }
  }

  problems.push(...getCheckoutModeProblems(environment));

  const configuredAsaasVariables = ASAAS_PRODUCTION_VARIABLES.filter((key) =>
    hasValue(environment, key)
  );
  if (
    (configuredAsaasVariables.length > 0 ||
      requiresAsaasCapability(environment)) &&
    configuredAsaasVariables.length < ASAAS_PRODUCTION_VARIABLES.length
  ) {
    problems.push(
      ...ASAAS_PRODUCTION_VARIABLES.filter((key) => !hasValue(environment, key))
    );
  }

  problems.push(...getAsaasWebhookSwitchProblems(environment));

  problems.push(...getUrlProblems(environment));

  const asaasBaseUrl = getParsedUrl(environment, "ASAAS_API_BASE_URL");
  if (
    hasValue(environment, "ASAAS_API_BASE_URL") &&
    (!asaasBaseUrl ||
      asaasBaseUrl.origin !== ASAAS_PRODUCTION_ORIGIN ||
      asaasBaseUrl.pathname !== "/" ||
      Boolean(asaasBaseUrl.search || asaasBaseUrl.hash) ||
      Boolean(asaasBaseUrl.username || asaasBaseUrl.password))
  ) {
    problems.push(`ASAAS_API_BASE_URL must equal ${ASAAS_PRODUCTION_ORIGIN}`);
  }

  const databaseUrl = getParsedUrl(environment, "DATABASE_URL");
  if (
    databaseUrl &&
    databaseUrl.protocol !== "postgres:" &&
    databaseUrl.protocol !== "postgresql:"
  ) {
    problems.push("DATABASE_URL must use the postgres or postgresql protocol");
  }

  const canonicalOrigins = [
    "BETTER_AUTH_URL",
    "CERTIFICATE_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
  ]
    .map((key) => getParsedUrl(environment, key)?.origin)
    .filter((origin): origin is string => Boolean(origin));

  if (canonicalOrigins.length === 3 && new Set(canonicalOrigins).size !== 1) {
    problems.push(
      "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must use the same origin"
    );
  }

  problems.push(...getSecretProblems(environment));

  if (hasValue(environment, "DATABASE_URL_DIRECT")) {
    problems.push("DATABASE_URL_DIRECT must not be set in the web runtime");
  }

  if (hasValue(environment, "INTERNAL_BOOTSTRAP_SECRET")) {
    problems.push("INTERNAL_BOOTSTRAP_SECRET must not be set in production");
  }

  return problems;
};
