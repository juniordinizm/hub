import { z } from "zod";

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
  CRON_SECRET: optionalNonEmptyString,
  DATA_RETENTION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_URL_DIRECT: optionalNonEmptyString,
  INTERNAL_BOOTSTRAP_SECRET: optionalNonEmptyString,
  JMVSTREAM_API_BASE_URL: z.string().url().default("https://api.jmvstream.com"),
  JMVSTREAM_AUTH_EMAIL: optionalNonEmptyString,
  JMVSTREAM_AUTH_PASSWORD: optionalNonEmptyString,
  JMVSTREAM_AUTH_RESOURCE: optionalNonEmptyString,
  JMVSTREAM_API_TOKEN: optionalNonEmptyString,
  JMVSTREAM_PLAN_ID: optionalNonEmptyString,
  LEGAL_APPROVAL_REFERENCE: optionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: z
    .string()
    .min(1)
    .default("PROTEA-R <noreply@example.com>"),
  SUPPORT_EMAIL: optionalNonEmptyString,
  VERCEL: optionalNonEmptyString,
});

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
    CRON_SECRET: process.env.CRON_SECRET,
    DATA_RETENTION_ENABLED: process.env.DATA_RETENTION_ENABLED,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    INTERNAL_BOOTSTRAP_SECRET: process.env.INTERNAL_BOOTSTRAP_SECRET,
    JMVSTREAM_API_BASE_URL: process.env.JMVSTREAM_API_BASE_URL,
    JMVSTREAM_AUTH_EMAIL: process.env.JMVSTREAM_AUTH_EMAIL,
    JMVSTREAM_AUTH_PASSWORD: process.env.JMVSTREAM_AUTH_PASSWORD,
    JMVSTREAM_AUTH_RESOURCE: process.env.JMVSTREAM_AUTH_RESOURCE,
    JMVSTREAM_API_TOKEN: process.env.JMVSTREAM_API_TOKEN,
    JMVSTREAM_PLAN_ID: process.env.JMVSTREAM_PLAN_ID,
    LEGAL_APPROVAL_REFERENCE: process.env.LEGAL_APPROVAL_REFERENCE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    VERCEL: process.env.VERCEL,
  });

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

  if (env.DATA_RETENTION_ENABLED && !env.LEGAL_APPROVAL_REFERENCE) {
    throw new Error(
      "LEGAL_APPROVAL_REFERENCE is required when DATA_RETENTION_ENABLED is true."
    );
  }

  if (
    env.NODE_ENV === "production" &&
    !process.env.CERTIFICATE_PUBLIC_BASE_URL?.trim()
  ) {
    throw new Error("CERTIFICATE_PUBLIC_BASE_URL is required in production.");
  }

  return {
    ...env,
    BETTER_AUTH_SECRET:
      env.BETTER_AUTH_SECRET ?? "development-secret-change-me",
  };
};
