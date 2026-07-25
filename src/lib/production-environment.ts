const REQUIRED_PRODUCTION_VARIABLES = [
  "ABACATEPAY_WEBHOOK_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CERTIFICATE_PUBLIC_BASE_URL",
  "CRON_SECRET",
  "DATABASE_URL",
  "HEALTHCHECK_SECRET",
  "JMVSTREAM_PLAN_ID",
  "NEXT_PUBLIC_APP_URL",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
  "R2_PUBLIC_BUCKET_NAME",
  "R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SUPPORT_EMAIL",
] as const;

const REQUIRED_PRODUCTION_ALTERNATIVES = [
  {
    keys: ["ABACATEPAY_API_KEY", "ABACATE_PAY_API_KEY"],
    label: "ABACATEPAY_API_KEY or ABACATE_PAY_API_KEY",
  },
  {
    keys: ["JMVSTREAM_AUTH_RESOURCE", "JMVSTREAM_API_TOKEN"],
    label: "JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN",
  },
] as const;

const hasValue = (
  environment: Readonly<Record<string, string | undefined>>,
  key: string
): boolean => Boolean(environment[key]?.trim());

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

  if (hasValue(environment, "DATABASE_URL_DIRECT")) {
    problems.push("DATABASE_URL_DIRECT must not be set in the web runtime");
  }

  if (hasValue(environment, "INTERNAL_BOOTSTRAP_SECRET")) {
    problems.push("INTERNAL_BOOTSTRAP_SECRET must not be set in production");
  }

  return problems;
};
