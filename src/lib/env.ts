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
  BETTER_AUTH_SECRET: z.string().min(1).default("development-secret-change-me"),
  BETTER_AUTH_TRUSTED_ORIGINS: optionalNonEmptyString,
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  CERTIFICATE_PUBLIC_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  CRON_SECRET: optionalNonEmptyString,
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_URL_DIRECT: optionalNonEmptyString,
  INTERNAL_BOOTSTRAP_SECRET: optionalNonEmptyString,
  JMVSTREAM_API_BASE_URL: z.string().url().default("https://api.jmvstream.com"),
  JMVSTREAM_API_TOKEN: optionalNonEmptyString,
  JMVSTREAM_PLAN_ID: optionalNonEmptyString,
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
});

export const getServerEnv = () =>
  serverEnvSchema.parse({
    ABACATEPAY_API_BASE_URL: process.env.ABACATEPAY_API_BASE_URL,
    ABACATEPAY_API_KEY: process.env.ABACATEPAY_API_KEY,
    ABACATEPAY_WEBHOOK_SECRET: process.env.ABACATEPAY_WEBHOOK_SECRET,
    ABACATE_PAY_API_KEY: process.env.ABACATE_PAY_API_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    CERTIFICATE_PUBLIC_BASE_URL: process.env.CERTIFICATE_PUBLIC_BASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    INTERNAL_BOOTSTRAP_SECRET: process.env.INTERNAL_BOOTSTRAP_SECRET,
    JMVSTREAM_API_BASE_URL: process.env.JMVSTREAM_API_BASE_URL,
    JMVSTREAM_API_TOKEN: process.env.JMVSTREAM_API_TOKEN,
    JMVSTREAM_PLAN_ID: process.env.JMVSTREAM_PLAN_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  });
