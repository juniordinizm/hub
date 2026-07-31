import { describe, expect, it } from "vitest";
import { getProductionEnvironmentProblems } from "./production-environment";

const COMPLETE_PRODUCTION_ENVIRONMENT: Record<string, string> = {
  ASAAS_API_BASE_URL: "https://api.asaas.com",
  ASAAS_API_KEY: "asaas-payment-key",
  ASAAS_USER_AGENT: "hub/1.0 support@example.com",
  ASAAS_WEBHOOK_ENABLED: "false",
  ASAAS_WEBHOOK_TOKEN:
    "asaas-production-webhook-token-at-least-thirty-two-characters",
  BETTER_AUTH_SECRET: "auth-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "https://app.example.com",
  CERTIFICATE_PUBLIC_BASE_URL: "https://app.example.com",
  CRON_SECRET: "cron-secret-at-least-thirty-two-characters",
  DATABASE_URL: "postgresql://runtime.example/db",
  HEALTHCHECK_SECRET: "health-secret-at-least-thirty-two-characters",
  JMVSTREAM_AUTH_RESOURCE: "resource-id",
  JMVSTREAM_PLAN_ID: "plan-id",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  PAYMENTS_CHECKOUT_MODE: "disabled",
  R2_ACCESS_KEY_ID: "r2-key",
  R2_ACCOUNT_ID: "r2-account",
  R2_BUCKET_NAME: "private-bucket",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
  R2_PUBLIC_BUCKET_NAME: "public-bucket",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "PROTEA-R <noreply@example.com>",
  SCHEDULED_JOBS_ENABLED: "true",
  SUPPORT_EMAIL: "support@example.com",
};

describe("production environment contract", () => {
  it("accepts a complete production runtime without build-only secrets", () => {
    expect(
      getProductionEnvironmentProblems(COMPLETE_PRODUCTION_ENVIRONMENT)
    ).toEqual([]);
  });

  it("requires an explicit checkout mode in Production", () => {
    const environment: Record<string, string | undefined> = {
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      PAYMENTS_CHECKOUT_MODE: undefined,
    };

    expect(getProductionEnvironmentProblems(environment)).toContain(
      "PAYMENTS_CHECKOUT_MODE"
    );
  });

  it("rejects an invalid checkout mode without exposing its value", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      PAYMENTS_CHECKOUT_MODE: "secret-invalid-mode",
    });

    expect(problems).toContain("PAYMENTS_CHECKOUT_MODE is invalid");
    expect(problems.join(" ")).not.toContain("secret-invalid-mode");
  });

  it.each([
    ["https://api-sandbox.asaas.com", "sandbox"],
    ["http://api.asaas.com", "http"],
    ["https://payments.example.com", "arbitrary host"],
    ["https://api.asaas.com/v3", "path"],
    ["https://api.asaas.com?tenant=1", "query"],
  ])("rejects an unsafe Asaas Production URL: %s (%s)", (baseUrl) => {
    expect(
      getProductionEnvironmentProblems({
        ...COMPLETE_PRODUCTION_ENVIRONMENT,
        ASAAS_API_BASE_URL: baseUrl,
      })
    ).toContain("ASAAS_API_BASE_URL must equal https://api.asaas.com");
  });

  it("accepts a trailing slash on the exact Asaas Production origin", () => {
    expect(
      getProductionEnvironmentProblems({
        ...COMPLETE_PRODUCTION_ENVIRONMENT,
        ASAAS_API_BASE_URL: "https://api.asaas.com/",
      })
    ).toEqual([]);
  });

  it("reports missing capabilities by variable name without values", () => {
    const problems = getProductionEnvironmentProblems({});

    expect(problems).toContain("DATABASE_URL");
    expect(problems).not.toContain("ASAAS_API_BASE_URL");
    expect(problems).not.toContain("ASAAS_API_KEY");
    expect(problems).not.toContain("ASAAS_USER_AGENT");
    expect(problems).not.toContain("ASAAS_WEBHOOK_TOKEN");
    expect(problems).toContain(
      "JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN"
    );
    expect(problems).not.toContain("DATABASE_URL_DIRECT");
    expect(problems).not.toContain("SENTRY_AUTH_TOKEN");
  });

  it("allows the disabled pre-cutover deploy without Asaas credentials", () => {
    const environment = Object.fromEntries(
      Object.entries(COMPLETE_PRODUCTION_ENVIRONMENT).filter(
        ([key]) => !key.startsWith("ASAAS_")
      )
    );

    expect(getProductionEnvironmentProblems(environment)).toEqual([]);
  });

  it.each([
    "authenticated",
    "public",
  ])("requires the complete Asaas capability when checkout mode is %s", (checkoutMode) => {
    const environment = Object.fromEntries(
      Object.entries(COMPLETE_PRODUCTION_ENVIRONMENT).filter(
        ([key]) => !key.startsWith("ASAAS_")
      )
    );
    environment.PAYMENTS_CHECKOUT_MODE = checkoutMode;

    expect(getProductionEnvironmentProblems(environment)).toEqual(
      expect.arrayContaining([
        "ASAAS_API_BASE_URL",
        "ASAAS_API_KEY",
        "ASAAS_USER_AGENT",
        "ASAAS_WEBHOOK_ENABLED",
        "ASAAS_WEBHOOK_TOKEN",
      ])
    );
  });

  it("requires the complete Asaas capability when its webhook is enabled", () => {
    const environment = Object.fromEntries(
      Object.entries(COMPLETE_PRODUCTION_ENVIRONMENT).filter(
        ([key]) => !key.startsWith("ASAAS_")
      )
    );
    environment.ASAAS_WEBHOOK_ENABLED = "true";

    expect(getProductionEnvironmentProblems(environment)).toEqual(
      expect.arrayContaining([
        "ASAAS_API_BASE_URL",
        "ASAAS_API_KEY",
        "ASAAS_USER_AGENT",
        "ASAAS_WEBHOOK_TOKEN",
      ])
    );
  });

  it("rejects a partially configured Asaas production capability", () => {
    const environment = Object.fromEntries(
      Object.entries(COMPLETE_PRODUCTION_ENVIRONMENT).filter(
        ([key]) => !key.startsWith("ASAAS_")
      )
    );
    environment.ASAAS_API_KEY = "configured-before-the-other-values";

    expect(getProductionEnvironmentProblems(environment)).toEqual(
      expect.arrayContaining([
        "ASAAS_API_BASE_URL",
        "ASAAS_USER_AGENT",
        "ASAAS_WEBHOOK_TOKEN",
      ])
    );
  });

  it("requires an explicit webhook switch with Asaas Production", () => {
    const environment: Record<string, string | undefined> = {
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      ASAAS_WEBHOOK_ENABLED: undefined,
    };

    expect(getProductionEnvironmentProblems(environment)).toContain(
      "ASAAS_WEBHOOK_ENABLED"
    );
  });

  it("rejects an invalid webhook switch without exposing its value", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      ASAAS_WEBHOOK_ENABLED: "secret-invalid-switch",
    });

    expect(problems).toContain(
      "ASAAS_WEBHOOK_ENABLED must equal true or false"
    );
    expect(problems.join(" ")).not.toContain("secret-invalid-switch");
  });

  it("rejects development-only variables in the production web runtime", () => {
    expect(
      getProductionEnvironmentProblems({
        ...COMPLETE_PRODUCTION_ENVIRONMENT,
        DATABASE_URL_DIRECT: "postgresql://direct.example/db",
        INTERNAL_BOOTSTRAP_SECRET: "bootstrap-secret",
      })
    ).toEqual([
      "DATABASE_URL_DIRECT must not be set in the web runtime",
      "INTERNAL_BOOTSTRAP_SECRET must not be set in production",
    ]);
  });

  it("rejects insecure public URLs and non-Postgres database URLs", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      BETTER_AUTH_URL: "http://app.example.com",
      DATABASE_URL: "https://database.example.com",
      R2_PUBLIC_BASE_URL: "http://media.example.com",
    });

    expect(problems).toContain("BETTER_AUTH_URL must use https");
    expect(problems).toContain("R2_PUBLIC_BASE_URL must use https");
    expect(problems).toContain(
      "DATABASE_URL must use the postgres or postgresql protocol"
    );
  });

  it("requires every canonical application URL to share the same origin", () => {
    expect(
      getProductionEnvironmentProblems({
        ...COMPLETE_PRODUCTION_ENVIRONMENT,
        CERTIFICATE_PUBLIC_BASE_URL: "https://certificates.example.com",
      })
    ).toContain(
      "BETTER_AUTH_URL, CERTIFICATE_PUBLIC_BASE_URL, and NEXT_PUBLIC_APP_URL must use the same origin"
    );
  });

  it("rejects weak first-party secrets without including their values", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      BETTER_AUTH_SECRET: "auth-value",
      CRON_SECRET: "cron-value",
      HEALTHCHECK_SECRET: "health-value",
      ASAAS_WEBHOOK_TOKEN: "webhook-value",
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET must contain at least 32 characters",
        "CRON_SECRET must contain at least 32 characters",
        "HEALTHCHECK_SECRET must contain at least 32 characters",
        "ASAAS_WEBHOOK_TOKEN must contain at least 32 characters",
      ])
    );
    expect(problems.join(" ")).not.toContain("auth-value");
  });
});
