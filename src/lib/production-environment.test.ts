import { describe, expect, it } from "vitest";
import { getProductionEnvironmentProblems } from "./production-environment";

const COMPLETE_PRODUCTION_ENVIRONMENT: Record<string, string> = {
  ABACATEPAY_API_KEY: "payment-key",
  ABACATEPAY_WEBHOOK_ENABLED: "false",
  ABACATEPAY_WEBHOOK_SECRET: "webhook-secret-at-least-thirty-two-characters",
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
    const environment = {
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      PAYMENTS_CHECKOUT_MODE: undefined,
    };

    expect(getProductionEnvironmentProblems(environment)).toContain(
      "PAYMENTS_CHECKOUT_MODE"
    );
  });

  it("requires an explicit AbacatePay webhook switch in Production", () => {
    const environment = {
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      ABACATEPAY_WEBHOOK_ENABLED: undefined,
    };

    expect(getProductionEnvironmentProblems(environment)).toContain(
      "ABACATEPAY_WEBHOOK_ENABLED"
    );
  });

  it("accepts only true or false for the AbacatePay webhook switch", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      ABACATEPAY_WEBHOOK_ENABLED: "secret-invalid-value",
    });

    expect(problems).toContain("ABACATEPAY_WEBHOOK_ENABLED is invalid");
    expect(problems.join(" ")).not.toContain("secret-invalid-value");
  });

  it("rejects an invalid checkout mode without exposing its value", () => {
    const problems = getProductionEnvironmentProblems({
      ...COMPLETE_PRODUCTION_ENVIRONMENT,
      PAYMENTS_CHECKOUT_MODE: "secret-invalid-mode",
    });

    expect(problems).toContain("PAYMENTS_CHECKOUT_MODE is invalid");
    expect(problems.join(" ")).not.toContain("secret-invalid-mode");
  });

  it("reports missing capabilities by variable name without values", () => {
    const problems = getProductionEnvironmentProblems({});

    expect(problems).toContain("DATABASE_URL");
    expect(problems).toContain("ABACATEPAY_API_KEY or ABACATE_PAY_API_KEY");
    expect(problems).toContain(
      "JMVSTREAM_AUTH_RESOURCE or JMVSTREAM_API_TOKEN"
    );
    expect(problems).not.toContain("DATABASE_URL_DIRECT");
    expect(problems).not.toContain("SENTRY_AUTH_TOKEN");
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
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET must contain at least 32 characters",
        "CRON_SECRET must contain at least 32 characters",
        "HEALTHCHECK_SECRET must contain at least 32 characters",
      ])
    );
    expect(problems.join(" ")).not.toContain("auth-value");
  });
});
