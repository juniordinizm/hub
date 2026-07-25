import { z } from "zod";
import { getProductionEnvironmentProblems } from "@/lib/production-environment";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}, z.string().min(1).optional());

const serverEnvSchema = z.object({
  ABACATEPAY_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.abacatepay.com/v2"),
  ABACATEPAY_API_KEY: optionalNonEmptyString,
  ABACATEPAY_WEBHOOK_SECRET: optionalNonEmptyString,
  ABACATE_PAY_API_KEY: optionalNonEmptyString,
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
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: z
    .string()
    .min(1)
    .default("PROTEA-R <noreply@example.com>"),
  SENTRY_DSN: optionalNonEmptyString,
  SUPPORT_EMAIL: optionalNonEmptyString,
  VERCEL: optionalNonEmptyString,
});

type ServerEnvironment = z.infer<typeof serverEnvSchema>;

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

const validateServerEnvironment = (env: ServerEnvironment): void => {
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  if (env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL?.trim()) {
    throw new Error("BETTER_AUTH_URL is required in production.");
  }

  if (
    env.NODE_ENV === "production" &&
    !process.env.NEXT_PUBLIC_APP_URL?.trim()
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }

  if (env.E2E_TEST_MODE && process.env.CI !== "true") {
    throw new Error("E2E_TEST_MODE requires CI=true.");
  }

  const isolatedE2eRuntime = isLoopbackE2eRuntime(env);
  if (env.E2E_TEST_MODE && !isolatedE2eRuntime) {
    throw new Error("E2E_TEST_MODE requires loopback application URLs.");
  }

  if (
    env.NODE_ENV === "production" &&
    !process.env.CERTIFICATE_PUBLIC_BASE_URL?.trim()
  ) {
    throw new Error("CERTIFICATE_PUBLIC_BASE_URL is required in production.");
  }

  if (env.NODE_ENV !== "production") {
    return;
  }

  const productionProblems = isolatedE2eRuntime
    ? [
        ...(process.env.DATABASE_URL_DIRECT?.trim()
          ? ["DATABASE_URL_DIRECT must not be set in the web runtime"]
          : []),
        ...(process.env.INTERNAL_BOOTSTRAP_SECRET?.trim()
          ? ["INTERNAL_BOOTSTRAP_SECRET must not be set in production"]
          : []),
      ]
    : getProductionEnvironmentProblems(process.env);

  if (productionProblems.length > 0) {
    throw new Error(
      `Production environment is incomplete: ${productionProblems.join(", ")}.`
    );
  }
};

export const getServerEnv = () => {
  const env = serverEnvSchema.parse({
    ABACATEPAY_API_BASE_URL: process.env.ABACATEPAY_API_BASE_URL,
    ABACATEPAY_API_KEY: process.env.ABACATEPAY_API_KEY,
    ABACATEPAY_WEBHOOK_SECRET: process.env.ABACATEPAY_WEBHOOK_SECRET,
    ABACATE_PAY_API_KEY: process.env.ABACATE_PAY_API_KEY,
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
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    VERCEL: process.env.VERCEL,
  });

  validateServerEnvironment(env);

  return {
    ...env,
    BETTER_AUTH_SECRET:
      env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
  };
};
