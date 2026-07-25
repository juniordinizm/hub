import { describe, expect, it } from "vitest";
import { getProductionEnvironmentProblems } from "./production-environment";

const COMPLETE_PRODUCTION_ENVIRONMENT: Record<string, string> = {
  ABACATEPAY_API_KEY: "payment-key",
  ABACATEPAY_WEBHOOK_SECRET: "webhook-secret",
  BETTER_AUTH_SECRET: "auth-secret",
  BETTER_AUTH_URL: "https://app.example.com",
  CERTIFICATE_PUBLIC_BASE_URL: "https://app.example.com",
  CRON_SECRET: "cron-secret",
  DATABASE_URL: "postgresql://runtime.example/db",
  HEALTHCHECK_SECRET: "health-secret",
  JMVSTREAM_AUTH_RESOURCE: "resource-id",
  JMVSTREAM_PLAN_ID: "plan-id",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  R2_ACCESS_KEY_ID: "r2-key",
  R2_ACCOUNT_ID: "r2-account",
  R2_BUCKET_NAME: "private-bucket",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
  R2_PUBLIC_BUCKET_NAME: "public-bucket",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "PROTEA-R <noreply@example.com>",
  SUPPORT_EMAIL: "support@example.com",
};

describe("production environment contract", () => {
  it("accepts a complete production runtime without build-only secrets", () => {
    expect(
      getProductionEnvironmentProblems(COMPLETE_PRODUCTION_ENVIRONMENT)
    ).toEqual([]);
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
});
