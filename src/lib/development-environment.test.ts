import { describe, expect, it } from "vitest";
import { getDevelopmentEnvironmentProblems } from "./development-environment";

const COMPLETE_DEVELOPMENT_ENVIRONMENT: Record<string, string> = {
  ABACATE_PAY_API_KEY: "abc_dev_key",
  ABACATEPAY_WEBHOOK_SECRET:
    "development-webhook-secret-at-least-thirty-two-characters",
  BETTER_AUTH_SECRET: "development-auth-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  CERTIFICATE_PUBLIC_BASE_URL: "http://localhost:3000",
  CRON_SECRET: "development-cron-secret-at-least-thirty-two-characters",
  DATABASE_URL:
    "postgresql://owner:secret@ep-shared-development-pooler.sa-east-1.aws.neon.tech/neondb",
  DATABASE_URL_DIRECT:
    "postgresql://owner:secret@ep-shared-development.sa-east-1.aws.neon.tech/neondb",
  DEVELOPMENT_ABACATEPAY_DEV_MODE: "true",
  DEVELOPMENT_DATABASE_HOST: "ep-shared-development.sa-east-1.aws.neon.tech",
  DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST: "dev@example.com",
  DEVELOPMENT_JMVSTREAM_PLAN_ID: "OD-30000",
  DEVELOPMENT_SENTRY_PROJECT_ID: "4511999999999999",
  E2E_TEST_MODE: "false",
  HEALTHCHECK_SECRET:
    "development-health-secret-at-least-thirty-two-characters",
  JMVSTREAM_AUTH_RESOURCE: "6a05c62e-5e71-47b8-9ac7-9c787ec626db",
  JMVSTREAM_PLAN_ID: "OD-30000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SENTRY_DSN:
    "https://public@example.ingest.sentry.io/4511999999999999",
  R2_ACCESS_KEY_ID: "development-r2-key",
  R2_ACCOUNT_ID: "development-r2-account",
  R2_BUCKET_NAME: "hub-development-private",
  R2_PUBLIC_BASE_URL: "https://pub-development.r2.dev",
  R2_PUBLIC_BUCKET_NAME: "hub-development-public",
  R2_SECRET_ACCESS_KEY: "development-r2-secret",
  RESEND_API_KEY: "re_development",
  RESEND_FROM_EMAIL: "Neuro Capacitar Dev <notificacoes@neurocapacitar.com.br>",
  SCHEDULED_JOBS_ENABLED: "true",
  SENTRY_DSN: "https://secret@example.ingest.sentry.io/4511999999999999",
  SUPPORT_EMAIL: "dev@example.com",
};

describe("Development environment contract", () => {
  it("accepts the complete shared Development environment", () => {
    expect(
      getDevelopmentEnvironmentProblems(COMPLETE_DEVELOPMENT_ENVIRONMENT)
    ).toEqual([]);
  });

  it("rejects both pooled and direct Production Neon endpoints", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      DATABASE_URL:
        "postgresql://owner:secret@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb",
      DATABASE_URL_DIRECT:
        "postgresql://owner:secret@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "DATABASE_URL must not target the Production Neon compute",
        "DATABASE_URL_DIRECT must not target the Production Neon compute",
      ])
    );
    expect(problems.join(" ")).not.toContain("secret");
  });

  it("accepts the shared Neuro Capacitar sender domain", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      RESEND_FROM_EMAIL:
        "Neuro Capacitar Dev <notificacoes@neurocapacitar.com.br>",
    });

    expect(problems).toEqual([]);
  });

  it("requires the approved Development buckets and sender domain", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      R2_BUCKET_NAME: "neuro-prod-private",
      R2_PUBLIC_BUCKET_NAME: "neuro-prod-public",
      RESEND_FROM_EMAIL: "Neuro Capacitar <notificacoes@example.com>",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "R2_BUCKET_NAME must equal hub-development-private",
        "R2_PUBLIC_BUCKET_NAME must equal hub-development-public",
        "RESEND_FROM_EMAIL must use neurocapacitar.com.br",
      ])
    );
  });

  it("rejects Production JMVStream and Sentry identifiers", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      DEVELOPMENT_JMVSTREAM_PLAN_ID: "OD-20912",
      DEVELOPMENT_SENTRY_PROJECT_ID: "4511771125219328",
      JMVSTREAM_PLAN_ID: "OD-20912",
      NEXT_PUBLIC_SENTRY_DSN:
        "https://public@example.ingest.sentry.io/4511771125219328",
      SENTRY_DSN: "https://secret@example.ingest.sentry.io/4511771125219328",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "JMVSTREAM_PLAN_ID must not target the Production plan",
        "SENTRY_DSN must not target the Production project",
        "NEXT_PUBLIC_SENTRY_DSN must not target the Production project",
      ])
    );
  });

  it("requires explicit provider and job confirmations", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      DEVELOPMENT_ABACATEPAY_DEV_MODE: "false",
      DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST: "",
      SCHEDULED_JOBS_ENABLED: "false",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "DEVELOPMENT_ABACATEPAY_DEV_MODE must equal true",
        "DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST is required",
        "SCHEDULED_JOBS_ENABLED must equal true",
      ])
    );
  });

  it("requires canonical application URLs to share one safe origin", () => {
    const problems = getDevelopmentEnvironmentProblems({
      ...COMPLETE_DEVELOPMENT_ENVIRONMENT,
      CERTIFICATE_PUBLIC_BASE_URL: "https://other.example.com",
    });

    expect(problems).toContain(
      "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must use the same Development origin"
    );
  });

  it("accepts isolated local E2E without Development providers", () => {
    const e2eDatabaseUrl =
      "postgresql://owner:secret@ep-disposable-e2e-pooler.sa-east-1.aws.neon.tech/neondb";

    expect(
      getDevelopmentEnvironmentProblems({
        CI: "true",
        DATABASE_URL: e2eDatabaseUrl,
        E2E_DATABASE_URL: e2eDatabaseUrl,
        E2E_R2_BUCKET_NAME: "hub-e2e",
        E2E_TEST_MODE: "true",
        R2_BUCKET_NAME: "hub-e2e",
        R2_ENDPOINT: "http://127.0.0.1:4568",
      })
    ).toEqual([]);
  });

  it("rejects local E2E when it inherits the Production database", () => {
    const problems = getDevelopmentEnvironmentProblems({
      CI: "true",
      DATABASE_URL:
        "postgresql://owner:secret@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb",
      E2E_DATABASE_URL:
        "postgresql://owner:secret@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb",
      E2E_R2_BUCKET_NAME: "hub-e2e",
      E2E_TEST_MODE: "true",
      R2_BUCKET_NAME: "hub-e2e",
      R2_ENDPOINT: "http://127.0.0.1:4568",
    });

    expect(problems).toContain(
      "E2E_DATABASE_URL must not target the Production Neon compute"
    );
  });
});
