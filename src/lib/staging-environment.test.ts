import { describe, expect, it } from "vitest";
import { getStagingEnvironmentProblems } from "./staging-environment";

const COMPLETE_STAGING_ENVIRONMENT: Record<string, string> = {
  APPLICATION_MAINTENANCE_MODE: "off",
  ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
  ASAAS_API_KEY: "$aact_hmlg_fixture",
  ASAAS_USER_AGENT: "hub/1.0 pagamentos@example.com",
  ASAAS_WEBHOOK_ENABLED: "true",
  ASAAS_WEBHOOK_TOKEN: "staging-webhook-token-at-least-thirty-two-characters",
  AUTH_PUBLIC_SIGNUP_ENABLED: "true",
  BETTER_AUTH_SECRET: "staging-auth-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "https://preview.neurocapacitar.com.br",
  CERTIFICATE_PUBLIC_BASE_URL: "https://preview.neurocapacitar.com.br",
  CLIENT_IP_SOURCE: "x-forwarded-for",
  CRON_SECRET: "staging-cron-secret-at-least-thirty-two-characters",
  DATABASE_URL:
    "postgresql://user:secret@ep-staging-pooler.sa-east-1.aws.neon.tech/neondb",
  HEALTHCHECK_SECRET: "staging-health-secret-at-least-thirty-two-characters",
  JMVSTREAM_AUTH_RESOURCE: "6a05c62e-5e71-47b8-9ac7-9c787ec626db",
  JMVSTREAM_PLAN_ID: "OD-20912",
  NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
  NEXT_PUBLIC_SENTRY_DSN:
    "https://public@example.ingest.sentry.io/4511999999999999",
  PAYMENTS_CHECKOUT_MODE: "public",
  R2_ACCESS_KEY_ID: "development-r2-key",
  R2_ACCOUNT_ID: "90058d5ae5098fe32c8c0e21209f3c86",
  R2_BUCKET_NAME: "hub-development-private",
  R2_OBJECT_PREFIX: "staging",
  R2_PUBLIC_BASE_URL: "https://pub-development.r2.dev",
  R2_PUBLIC_BUCKET_NAME: "hub-development-public",
  R2_SECRET_ACCESS_KEY: "development-r2-secret",
  RESEND_API_KEY: "re_shared",
  RESEND_FROM_EMAIL: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
  RESEND_WEBHOOK_SECRET: "resend-webhook-secret-at-least-32-characters",
  SCHEDULED_JOBS_ENABLED: "true",
  SENTRY_DSN: "https://secret@example.ingest.sentry.io/4511999999999999",
  STAGING_DATABASE_HOST: "ep-staging.sa-east-1.aws.neon.tech",
  STAGING_EMAIL_RECIPIENT_ALLOWLIST:
    "staging-recipient@example.com,staging-ops@example.com",
  STAGING_JMVSTREAM_USES_PRODUCTION: "true",
  STAGING_R2_USES_DEVELOPMENT: "true",
  STAGING_RESEND_USES_PRODUCTION: "true",
  STAGING_SENTRY_PROJECT_ID: "4511999999999999",
  SUPPORT_EMAIL: "suporte@neurocapacitar.com.br",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "staging",
};

describe("Staging environment contract", () => {
  it("accepts the complete approved Staging runtime", () => {
    expect(getStagingEnvironmentProblems(COMPLETE_STAGING_ENVIRONMENT)).toEqual(
      []
    );
  });

  it("requires the custom target and exact canonical origin", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      CERTIFICATE_PUBLIC_BASE_URL: "https://other.example.com",
      VERCEL_TARGET_ENV: "preview",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "VERCEL_TARGET_ENV must equal staging",
        "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must equal the Staging origin",
      ])
    );
  });

  it("requires the confirmed Staging database and rejects Production", () => {
    const wrongHostProblems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      DATABASE_URL:
        "postgresql://user:secret@ep-other-pooler.sa-east-1.aws.neon.tech/neondb",
    });
    expect(wrongHostProblems).toContain(
      "DATABASE_URL must target STAGING_DATABASE_HOST"
    );

    const productionProblems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      DATABASE_URL:
        "postgresql://user:do-not-print@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb",
      STAGING_DATABASE_HOST: "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
    });
    expect(productionProblems).toContain(
      "DATABASE_URL must not target the Production Neon compute"
    );
    expect(productionProblems.join(" ")).not.toContain("do-not-print");
  });

  it.each([
    ["https://api.asaas.com", "production"],
    ["http://api-sandbox.asaas.com", "http"],
    ["https://api-sandbox.asaas.com/v3", "path"],
  ])("rejects unsafe Asaas base URL %s (%s)", (baseUrl) => {
    expect(
      getStagingEnvironmentProblems({
        ...COMPLETE_STAGING_ENVIRONMENT,
        ASAAS_API_BASE_URL: baseUrl,
      })
    ).toContain("ASAAS_API_BASE_URL must equal https://api-sandbox.asaas.com");
  });

  it("rejects an Asaas Production key without exposing it", () => {
    const unsafeKey = "$aact_prod_do-not-print";
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      ASAAS_API_KEY: unsafeKey,
    });

    expect(problems).toContain("ASAAS_API_KEY must be a Sandbox key");
    expect(problems.join(" ")).not.toContain(unsafeKey);
  });

  it("preserves explicit incident kill switches", () => {
    expect(
      getStagingEnvironmentProblems({
        ...COMPLETE_STAGING_ENVIRONMENT,
        ASAAS_WEBHOOK_ENABLED: "false",
        PAYMENTS_CHECKOUT_MODE: "disabled",
        SCHEDULED_JOBS_ENABLED: "false",
      })
    ).toEqual([]);
  });

  it("requires explicit switches, public signup, and maintenance off", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      APPLICATION_MAINTENANCE_MODE: "full",
      ASAAS_WEBHOOK_ENABLED: "",
      AUTH_PUBLIC_SIGNUP_ENABLED: "false",
      PAYMENTS_CHECKOUT_MODE: "",
      SCHEDULED_JOBS_ENABLED: "",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "APPLICATION_MAINTENANCE_MODE must equal off",
        "ASAAS_WEBHOOK_ENABLED is required",
        "AUTH_PUBLIC_SIGNUP_ENABLED must equal true",
        "PAYMENTS_CHECKOUT_MODE is required",
        "SCHEDULED_JOBS_ENABLED is required",
      ])
    );
  });

  it("requires the approved R2 namespace and sharing acknowledgement", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      R2_BUCKET_NAME: "hub-production-private",
      R2_OBJECT_PREFIX: "development",
      R2_PUBLIC_BUCKET_NAME: "hub-production-public",
      STAGING_R2_USES_DEVELOPMENT: "false",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "R2_BUCKET_NAME must equal hub-development-private",
        "R2_OBJECT_PREFIX must equal staging",
        "R2_PUBLIC_BUCKET_NAME must equal hub-development-public",
        "STAGING_R2_USES_DEVELOPMENT must equal true",
      ])
    );
  });

  it("requires approved JMVStream and Resend sharing", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      JMVSTREAM_PLAN_ID: "OD-OTHER",
      RESEND_FROM_EMAIL: "Neuro Capacitar <sender@example.com>",
      STAGING_JMVSTREAM_USES_PRODUCTION: "false",
      STAGING_RESEND_USES_PRODUCTION: "false",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "JMVSTREAM_PLAN_ID must equal the approved Production plan",
        "RESEND_FROM_EMAIL must use neurocapacitar.com.br",
        "STAGING_JMVSTREAM_USES_PRODUCTION must equal true",
        "STAGING_RESEND_USES_PRODUCTION must equal true",
      ])
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["placeholder", "<staging-recipient@example.com>"],
  ] as const)("requires a configured Staging email recipient allowlist for %s without exposing values", (_case, allowlist) => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      STAGING_EMAIL_RECIPIENT_ALLOWLIST: allowlist,
    });

    expect(problems).toEqual(["STAGING_EMAIL_RECIPIENT_ALLOWLIST is required"]);
    expect(problems.join(" ")).not.toContain(
      COMPLETE_STAGING_ENVIRONMENT.STAGING_EMAIL_RECIPIENT_ALLOWLIST
    );
  });

  it("requires the shared Development Sentry project, not Production", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      NEXT_PUBLIC_SENTRY_DSN:
        "https://public@example.ingest.sentry.io/4511951566798848",
      SENTRY_DSN: "https://secret@example.ingest.sentry.io/4511951566798848",
      STAGING_SENTRY_PROJECT_ID: "4511951566798848",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SENTRY_DSN must not target the Production project",
        "SENTRY_DSN must not target the Production project",
      ])
    );
  });

  it("rejects weak first-party secrets without exposing values", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      ASAAS_WEBHOOK_TOKEN: "weak-webhook",
      BETTER_AUTH_SECRET: "weak-auth",
      CRON_SECRET: "weak-cron",
      HEALTHCHECK_SECRET: "weak-health",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "ASAAS_WEBHOOK_TOKEN must contain at least 32 characters",
        "BETTER_AUTH_SECRET must contain at least 32 characters",
        "CRON_SECRET must contain at least 32 characters",
        "HEALTHCHECK_SECRET must contain at least 32 characters",
      ])
    );
    expect(problems.join(" ")).not.toContain("weak-auth");
  });

  it("rejects build, migration, bootstrap, and E2E-only variables", () => {
    const problems = getStagingEnvironmentProblems({
      ...COMPLETE_STAGING_ENVIRONMENT,
      DATABASE_URL_DIRECT: "postgresql://user:secret@direct.example/db",
      E2E_DATABASE_URL: "postgresql://user:secret@e2e.example/db",
      E2E_TEST_MODE: "true",
      INTERNAL_BOOTSTRAP_SECRET: "bootstrap-secret",
      SMOKE_DATABASE_URL: "postgresql://user:secret@smoke.example/db",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "DATABASE_URL_DIRECT must not be set in the Staging web runtime",
        "E2E_DATABASE_URL must not be set in Staging",
        "E2E_TEST_MODE must not be set in Staging",
        "INTERNAL_BOOTSTRAP_SECRET must not be set in Staging",
        "SMOKE_DATABASE_URL must not be set in Staging",
      ])
    );
    expect(problems.join(" ")).not.toContain("bootstrap-secret");
  });
});
