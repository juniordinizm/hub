import { describe, expect, it } from "vitest";
import { getPreviewEnvironmentProblems } from "./preview-environment";

const COMPLETE_PREVIEW_ENVIRONMENT: Record<string, string> = {
  AUTH_PUBLIC_SIGNUP_ENABLED: "false",
  BETTER_AUTH_SECRET: "preview-auth-secret-at-least-thirty-two-characters",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  DATABASE_URL: "postgresql://preview.example/db",
  HEALTHCHECK_SECRET: "preview-health-secret-at-least-thirty-two-characters",
  SCHEDULED_JOBS_ENABLED: "false",
  VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
  VERCEL_ENV: "preview",
};

const FORBIDDEN_PREVIEW_VARIABLES = [
  "ABACATEPAY_API_KEY",
  "ABACATEPAY_WEBHOOK_SECRET",
  "ABACATE_PAY_API_KEY",
  "ASAAS_API_BASE_URL",
  "ASAAS_API_KEY",
  "ASAAS_USER_AGENT",
  "ASAAS_WEBHOOK_TOKEN",
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

describe("Preview environment contract", () => {
  it("accepts only the isolated infrastructure smoke configuration", () => {
    expect(getPreviewEnvironmentProblems(COMPLETE_PREVIEW_ENVIRONMENT)).toEqual(
      []
    );
  });

  it.each(
    FORBIDDEN_PREVIEW_VARIABLES
  )("rejects forbidden variable %s without exposing its value", (name) => {
    const forbiddenValue = "sensitive-value-that-must-not-be-reported";
    const problems = getPreviewEnvironmentProblems({
      ...COMPLETE_PREVIEW_ENVIRONMENT,
      [name]: forbiddenValue,
    });

    expect(problems).toContain(`${name} must not be set in Preview`);
    expect(problems.join(" ")).not.toContain(forbiddenValue);
  });

  it("accepts the generated deployment hostname for CLI previews", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        VERCEL_BRANCH_URL: "",
        VERCEL_URL: "protected-deployment.vercel.app",
      })
    ).toEqual([]);
  });

  it("requires a Vercel branch alias or generated deployment hostname", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        VERCEL_BRANCH_URL: "",
        VERCEL_URL: "",
      })
    ).toContain("VERCEL_BRANCH_URL or VERCEL_URL is required in Preview");
  });

  it("keeps jobs and public sign-up disabled", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        AUTH_PUBLIC_SIGNUP_ENABLED: "true",
        SCHEDULED_JOBS_ENABLED: "true",
      })
    ).toEqual(
      expect.arrayContaining([
        "AUTH_PUBLIC_SIGNUP_ENABLED must equal false in Preview",
        "SCHEDULED_JOBS_ENABLED must equal false in Preview",
      ])
    );
  });

  it.each(["authenticated", "public"])("rejects %s checkout mode", (mode) => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        PAYMENTS_CHECKOUT_MODE: mode,
      })
    ).toContain("PAYMENTS_CHECKOUT_MODE must equal disabled in Preview");
  });

  it("accepts an explicit disabled checkout mode", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        PAYMENTS_CHECKOUT_MODE: "disabled",
      })
    ).toEqual([]);
  });

  it("rejects an enabled Asaas webhook", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        ASAAS_WEBHOOK_ENABLED: "true",
      })
    ).toContain("ASAAS_WEBHOOK_ENABLED must equal false in Preview");
  });

  it("accepts an explicitly disabled Asaas webhook", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        ASAAS_WEBHOOK_ENABLED: "false",
      })
    ).toEqual([]);
  });

  it("requires Vercel proxy attribution", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        CLIENT_IP_SOURCE: "cloudflare",
      })
    ).toContain("CLIENT_IP_SOURCE must equal x-forwarded-for in Preview");
  });

  it("rejects weak first-party secrets without exposing their values", () => {
    const problems = getPreviewEnvironmentProblems({
      ...COMPLETE_PREVIEW_ENVIRONMENT,
      BETTER_AUTH_SECRET: "weak-auth",
      HEALTHCHECK_SECRET: "weak-health",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET must contain at least 32 characters",
        "HEALTHCHECK_SECRET must contain at least 32 characters",
      ])
    );
    expect(problems.join(" ")).not.toContain("weak-auth");
    expect(problems.join(" ")).not.toContain("weak-health");
  });

  it("requires a PostgreSQL runtime URL", () => {
    expect(
      getPreviewEnvironmentProblems({
        ...COMPLETE_PREVIEW_ENVIRONMENT,
        DATABASE_URL: "https://database.example.com",
      })
    ).toContain("DATABASE_URL must use the postgres or postgresql protocol");
  });
});
