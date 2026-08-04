import { z } from "zod";
import { resolveCanonicalApplicationEnvironment } from "@/lib/application-origin";
import { getPreviewEnvironmentProblems } from "@/lib/preview-environment";
import { getProductionEnvironmentProblems } from "@/lib/production-environment";
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment";
import { getStagingEnvironmentProblems } from "@/lib/staging-environment";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}, z.string().min(1).optional());

const serverEnvSchema = z.object({
  APPLICATION_MAINTENANCE_MODE: z.enum(["full", "off"]).default("off"),
  ASAAS_API_BASE_URL: z.string().url().optional(),
  ASAAS_API_KEY: optionalNonEmptyString,
  ASAAS_PAYMENT_RETURN_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ASAAS_USER_AGENT: optionalNonEmptyString,
  ASAAS_WEBHOOK_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  ASAAS_WEBHOOK_TOKEN: optionalNonEmptyString,
  AUTH_PUBLIC_SIGNUP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  BETTER_AUTH_API_KEY: optionalNonEmptyString,
  BETTER_AUTH_API_URL: optionalNonEmptyString,
  BETTER_AUTH_KV_URL: optionalNonEmptyString,
  BETTER_AUTH_SECRET: optionalNonEmptyString,
  BETTER_AUTH_TRUSTED_ORIGINS: optionalNonEmptyString,
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  CERTIFICATE_PUBLIC_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  CLIENT_IP_SOURCE: z
    .enum(["cloudflare", "x-forwarded-for"])
    .default("x-forwarded-for"),
  CRON_SECRET: optionalNonEmptyString,
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_URL_DIRECT: optionalNonEmptyString,
  DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST: optionalNonEmptyString,
  E2E_TEST_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  HEALTHCHECK_SECRET: optionalNonEmptyString,
  INTERNAL_BOOTSTRAP_SECRET: optionalNonEmptyString,
  JMVSTREAM_API_BASE_URL: z.string().url().default("https://api.jmvstream.com"),
  JMVSTREAM_AUTH_RESOURCE: optionalNonEmptyString,
  JMVSTREAM_API_TOKEN: optionalNonEmptyString,
  JMVSTREAM_PLAN_ID: optionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SENTRY_DSN: optionalNonEmptyString,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PAYMENTS_CHECKOUT_MODE: z.enum(["disabled", "authenticated", "public"]),
  R2_OBJECT_PREFIX: optionalNonEmptyString,
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: z
    .string()
    .min(1)
    .default("PROTEA-R <noreply@example.com>"),
  SENTRY_DSN: optionalNonEmptyString,
  SCHEDULED_JOBS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SUPPORT_EMAIL: optionalNonEmptyString,
  STAGING_DATABASE_HOST: optionalNonEmptyString,
  STAGING_JMVSTREAM_USES_PRODUCTION: optionalNonEmptyString,
  STAGING_R2_USES_DEVELOPMENT: optionalNonEmptyString,
  STAGING_RESEND_USES_PRODUCTION: optionalNonEmptyString,
  STAGING_SENTRY_PROJECT_ID: optionalNonEmptyString,
  VERCEL: optionalNonEmptyString,
  VERCEL_BRANCH_URL: optionalNonEmptyString,
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  VERCEL_TARGET_ENV: optionalNonEmptyString,
  VERCEL_URL: optionalNonEmptyString,
});

type ServerEnvironment = z.infer<typeof serverEnvSchema>;
type RawEnvironment = Readonly<Record<string, string | undefined>>;

const isLoopbackE2eRuntime = (env: ServerEnvironment): boolean => {
  const applicationUrls = [
    env.BETTER_AUTH_URL,
    env.CERTIFICATE_PUBLIC_BASE_URL,
    env.NEXT_PUBLIC_APP_URL,
  ].map((value) => new URL(value));

  return (
    env.E2E_TEST_MODE &&
    applicationUrls.every((url) =>
      ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)
    ) &&
    new Set(applicationUrls.map((url) => url.origin)).size === 1
  );
};

const validateCanonicalProductionUrls = (
  rawEnvironment: RawEnvironment
): void => {
  if (!rawEnvironment.BETTER_AUTH_URL?.trim()) {
    throw new Error("BETTER_AUTH_URL is required in production.");
  }

  if (!rawEnvironment.NEXT_PUBLIC_APP_URL?.trim()) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }

  if (!rawEnvironment.CERTIFICATE_PUBLIC_BASE_URL?.trim()) {
    throw new Error("CERTIFICATE_PUBLIC_BASE_URL is required in production.");
  }
};

const getIsolatedE2eProductionProblems = (
  rawEnvironment: RawEnvironment
): string[] => [
  ...(rawEnvironment.DATABASE_URL_DIRECT?.trim()
    ? ["DATABASE_URL_DIRECT must not be set in the web runtime"]
    : []),
  ...(rawEnvironment.INTERNAL_BOOTSTRAP_SECRET?.trim()
    ? ["INTERNAL_BOOTSTRAP_SECRET must not be set in production"]
    : []),
];

const validateServerEnvironment = (
  env: ServerEnvironment,
  rawEnvironment: RawEnvironment
): void => {
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  if (env.E2E_TEST_MODE && rawEnvironment.CI !== "true") {
    throw new Error("E2E_TEST_MODE requires CI=true.");
  }

  if (
    env.ASAAS_PAYMENT_RETURN_ENABLED &&
    new URL(env.NEXT_PUBLIC_APP_URL).protocol !== "https:"
  ) {
    throw new Error(
      "ASAAS_PAYMENT_RETURN_ENABLED requires an HTTPS NEXT_PUBLIC_APP_URL."
    );
  }

  const isolatedE2eRuntime = isLoopbackE2eRuntime(env);
  if (env.E2E_TEST_MODE && !isolatedE2eRuntime) {
    throw new Error("E2E_TEST_MODE requires loopback application URLs.");
  }

  const runtimeEnvironment = resolveRuntimeEnvironment(rawEnvironment);

  if (runtimeEnvironment === "staging") {
    const stagingProblems = getStagingEnvironmentProblems(rawEnvironment);

    if (stagingProblems.length > 0) {
      throw new Error(
        `Staging environment is invalid: ${stagingProblems.join(", ")}.`
      );
    }

    return;
  }

  if (runtimeEnvironment === "preview") {
    const previewProblems = getPreviewEnvironmentProblems(rawEnvironment);

    if (previewProblems.length > 0) {
      throw new Error(
        `Preview environment is invalid: ${previewProblems.join(", ")}.`
      );
    }

    return;
  }

  if (env.NODE_ENV !== "production") {
    return;
  }

  validateCanonicalProductionUrls(rawEnvironment);

  const productionProblems = isolatedE2eRuntime
    ? getIsolatedE2eProductionProblems(rawEnvironment)
    : getProductionEnvironmentProblems(rawEnvironment);

  if (productionProblems.length > 0) {
    throw new Error(
      `Production environment is incomplete: ${productionProblems.join(", ")}.`
    );
  }
};

export const getServerEnv = () => {
  const rawEnvironment = {
    ...process.env,
    APPLICATION_MAINTENANCE_MODE: process.env.APPLICATION_MAINTENANCE_MODE,
    ASAAS_API_BASE_URL: process.env.ASAAS_API_BASE_URL,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_PAYMENT_RETURN_ENABLED: process.env.ASAAS_PAYMENT_RETURN_ENABLED,
    ASAAS_USER_AGENT: process.env.ASAAS_USER_AGENT,
    ASAAS_WEBHOOK_ENABLED: process.env.ASAAS_WEBHOOK_ENABLED,
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN,
    AUTH_PUBLIC_SIGNUP_ENABLED: process.env.AUTH_PUBLIC_SIGNUP_ENABLED,
    BETTER_AUTH_API_KEY: process.env.BETTER_AUTH_API_KEY,
    BETTER_AUTH_API_URL: process.env.BETTER_AUTH_API_URL,
    BETTER_AUTH_KV_URL: process.env.BETTER_AUTH_KV_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    CERTIFICATE_PUBLIC_BASE_URL: process.env.CERTIFICATE_PUBLIC_BASE_URL,
    CLIENT_IP_SOURCE: process.env.CLIENT_IP_SOURCE,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST:
      process.env.DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST,
    E2E_TEST_MODE: process.env.E2E_TEST_MODE,
    HEALTHCHECK_SECRET: process.env.HEALTHCHECK_SECRET,
    INTERNAL_BOOTSTRAP_SECRET: process.env.INTERNAL_BOOTSTRAP_SECRET,
    JMVSTREAM_API_BASE_URL: process.env.JMVSTREAM_API_BASE_URL,
    JMVSTREAM_AUTH_RESOURCE: process.env.JMVSTREAM_AUTH_RESOURCE,
    JMVSTREAM_API_TOKEN: process.env.JMVSTREAM_API_TOKEN,
    JMVSTREAM_PLAN_ID: process.env.JMVSTREAM_PLAN_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
    PAYMENTS_CHECKOUT_MODE: process.env.PAYMENTS_CHECKOUT_MODE,
    R2_OBJECT_PREFIX: process.env.R2_OBJECT_PREFIX,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SCHEDULED_JOBS_ENABLED: process.env.SCHEDULED_JOBS_ENABLED,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    STAGING_DATABASE_HOST: process.env.STAGING_DATABASE_HOST,
    STAGING_JMVSTREAM_USES_PRODUCTION:
      process.env.STAGING_JMVSTREAM_USES_PRODUCTION,
    STAGING_R2_USES_DEVELOPMENT: process.env.STAGING_R2_USES_DEVELOPMENT,
    STAGING_RESEND_USES_PRODUCTION: process.env.STAGING_RESEND_USES_PRODUCTION,
    STAGING_SENTRY_PROJECT_ID: process.env.STAGING_SENTRY_PROJECT_ID,
    VERCEL: process.env.VERCEL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  };
  const sourceEnvironment =
    resolveCanonicalApplicationEnvironment(rawEnvironment);
  const runtimeEnvironment = resolveRuntimeEnvironment(rawEnvironment);
  const environmentWithRuntimeDefaults = {
    ...sourceEnvironment,
    ASAAS_WEBHOOK_ENABLED:
      sourceEnvironment.ASAAS_WEBHOOK_ENABLED ??
      (runtimeEnvironment === "development" ? "true" : "false"),
    PAYMENTS_CHECKOUT_MODE:
      sourceEnvironment.PAYMENTS_CHECKOUT_MODE ??
      (runtimeEnvironment === "preview" ? "disabled" : "public"),
  };
  const env = serverEnvSchema.parse(environmentWithRuntimeDefaults);

  validateServerEnvironment(env, rawEnvironment);

  return {
    ...env,
    BETTER_AUTH_SECRET:
      env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
  };
};
