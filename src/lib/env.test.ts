import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv, isIsolatedE2eRuntime } from "./env";

const DATABASE_URL_ERROR_PATTERN = /DATABASE_URL/;

const ORIGINAL_ENV = { ...process.env };

const STRICT_E2E_ENVIRONMENT = {
  BETTER_AUTH_URL: "http://127.0.0.1:3100",
  CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
  CI: "true",
  E2E_TEST_MODE: "true",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
} as const;

const setEnv = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
};

describe("server environment", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses a development auth secret only outside production", () => {
    setEnv("NODE_ENV", "development");
    setEnv("BETTER_AUTH_SECRET", "");

    expect(getServerEnv().BETTER_AUTH_SECRET).toBe(
      "development-secret-change-me"
    );
  });

  it("defaults checkout to public in Development", () => {
    setEnv("NODE_ENV", "development");
    setEnv("PAYMENTS_CHECKOUT_MODE", undefined);
    setEnv("VERCEL_ENV", undefined);

    expect(getServerEnv().PAYMENTS_CHECKOUT_MODE).toBe("public");
  });

  it("defaults the Asaas webhook to enabled in Development", () => {
    setEnv("NODE_ENV", "development");
    setEnv("ASAAS_WEBHOOK_ENABLED", undefined);
    setEnv("VERCEL_ENV", undefined);

    expect(getServerEnv().ASAAS_WEBHOOK_ENABLED).toBe(true);
  });

  it("requires an explicit auth secret in production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("BETTER_AUTH_SECRET", "");

    expect(() => getServerEnv()).toThrow(
      "BETTER_AUTH_SECRET is required in production."
    );
  });

  it("requires canonical auth and app URLs in production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("BETTER_AUTH_SECRET", "production-secret");
    setEnv("BETTER_AUTH_URL", "https://app.example.com");
    setEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    setEnv("CERTIFICATE_PUBLIC_BASE_URL", undefined);

    expect(() => getServerEnv()).toThrow(
      "CERTIFICATE_PUBLIC_BASE_URL is required in production."
    );
  });

  it("accepts the isolated Vercel Preview runtime without providers", () => {
    process.env = {
      AUTH_PUBLIC_SIGNUP_ENABLED: "false",
      BETTER_AUTH_SECRET: "preview-auth-secret-at-least-thirty-two-characters",
      CLIENT_IP_SOURCE: "x-forwarded-for",
      DATABASE_URL: "postgresql://preview.example/db",
      HEALTHCHECK_SECRET:
        "preview-health-secret-at-least-thirty-two-characters",
      NODE_ENV: "production",
      SCHEDULED_JOBS_ENABLED: "false",
      VERCEL: "1",
      VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
      VERCEL_ENV: "preview",
    };

    const env = getServerEnv();

    expect(env.BETTER_AUTH_URL).toBe(
      "https://hub-git-feature-neuro-capacitar.vercel.app"
    );
    expect(env.NEXT_PUBLIC_APP_URL).toBe(
      "https://hub-git-feature-neuro-capacitar.vercel.app"
    );
    expect(env.CERTIFICATE_PUBLIC_BASE_URL).toBe(
      "https://hub-git-feature-neuro-capacitar.vercel.app"
    );
    expect(env.PAYMENTS_CHECKOUT_MODE).toBe("disabled");
    expect(env.ASAAS_WEBHOOK_ENABLED).toBe(false);
  });

  it("rejects provider credentials in Vercel Preview", () => {
    process.env = {
      AUTH_PUBLIC_SIGNUP_ENABLED: "false",
      BETTER_AUTH_SECRET: "preview-auth-secret-at-least-thirty-two-characters",
      CLIENT_IP_SOURCE: "x-forwarded-for",
      DATABASE_URL: "postgresql://preview.example/db",
      HEALTHCHECK_SECRET:
        "preview-health-secret-at-least-thirty-two-characters",
      NODE_ENV: "production",
      RESEND_API_KEY: "must-not-be-used-in-preview",
      SCHEDULED_JOBS_ENABLED: "false",
      VERCEL: "1",
      VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
      VERCEL_ENV: "preview",
    };

    expect(() => getServerEnv()).toThrow(
      "RESEND_API_KEY must not be set in Preview"
    );
  });

  it("accepts the complete Staging runtime instead of treating it as Preview", () => {
    process.env = {
      APPLICATION_MAINTENANCE_MODE: "off",
      ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
      ASAAS_API_KEY: "$aact_hmlg_fixture",
      ASAAS_USER_AGENT: "hub/1.0 pagamentos@example.com",
      ASAAS_WEBHOOK_ENABLED: "true",
      ASAAS_WEBHOOK_TOKEN:
        "staging-webhook-token-at-least-thirty-two-characters",
      AUTH_PUBLIC_SIGNUP_ENABLED: "true",
      BETTER_AUTH_SECRET: "staging-auth-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: "https://preview.neurocapacitar.com.br",
      CERTIFICATE_PUBLIC_BASE_URL: "https://preview.neurocapacitar.com.br",
      CLIENT_IP_SOURCE: "x-forwarded-for",
      CRON_SECRET: "staging-cron-secret-at-least-thirty-two-characters",
      DATABASE_URL:
        "postgresql://user:secret@ep-staging-pooler.sa-east-1.aws.neon.tech/neondb",
      HEALTHCHECK_SECRET:
        "staging-health-secret-at-least-thirty-two-characters",
      JMVSTREAM_AUTH_RESOURCE: "fixture-resource",
      JMVSTREAM_PLAN_ID: "OD-20912",
      NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
      NEXT_PUBLIC_SENTRY_DSN:
        "https://public@example.ingest.sentry.io/4511999999999999",
      NODE_ENV: "production",
      PAYMENTS_CHECKOUT_MODE: "public",
      R2_ACCESS_KEY_ID: "development-r2-key",
      R2_ACCOUNT_ID: "fixture-account",
      R2_BUCKET_NAME: "hub-development-private",
      R2_OBJECT_PREFIX: "staging",
      R2_PUBLIC_BASE_URL: "https://pub-development.r2.dev",
      R2_PUBLIC_BUCKET_NAME: "hub-development-public",
      R2_SECRET_ACCESS_KEY: "development-r2-secret",
      RESEND_API_KEY: "re_shared",
      RESEND_FROM_EMAIL: "Neuro Capacitar <notificacoes@neurocapacitar.com.br>",
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

    const env = getServerEnv();

    expect(env.VERCEL_TARGET_ENV).toBe("staging");
    expect(env.NEXT_PUBLIC_APP_URL).toBe(
      "https://preview.neurocapacitar.com.br"
    );
    expect(env.PAYMENTS_CHECKOUT_MODE).toBe("public");
    expect(env.ASAAS_WEBHOOK_ENABLED).toBe(true);
    expect(env.STAGING_EMAIL_RECIPIENT_ALLOWLIST).toBe(
      "staging-recipient@example.com,staging-ops@example.com"
    );
  });

  it("keeps public sign-up disabled by default", () => {
    setEnv("NODE_ENV", "development");
    setEnv("AUTH_PUBLIC_SIGNUP_ENABLED", undefined);

    expect(getServerEnv().AUTH_PUBLIC_SIGNUP_ENABLED).toBe(false);
  });

  it("only permits E2E mode in CI", () => {
    setEnv("NODE_ENV", "development");
    setEnv("E2E_TEST_MODE", "true");
    setEnv("BETTER_AUTH_URL", "http://127.0.0.1:3100");
    setEnv("CERTIFICATE_PUBLIC_BASE_URL", "http://127.0.0.1:3100");
    setEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3100");
    setEnv("CI", undefined);

    expect(() => getServerEnv()).toThrow("E2E_TEST_MODE requires CI=true.");

    setEnv("CI", "true");
    expect(getServerEnv().E2E_TEST_MODE).toBe(true);
  });

  it("permits an isolated production E2E runtime without external providers", () => {
    process.env = {
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
      CI: "true",
      DATABASE_URL: "postgresql://e2e.example/db",
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      NODE_ENV: "production",
    };

    expect(getServerEnv().E2E_TEST_MODE).toBe(true);
  });

  it.each([
    ["Production", { VERCEL_ENV: "production" }],
    ["Preview", { VERCEL_ENV: "preview" }],
    ["Staging", { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "staging" }],
  ] as const)("rejects E2E mode in Vercel %s", (_name, vercelEnvironment) => {
    process.env = {
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
      CI: "true",
      DATABASE_URL: "postgresql://e2e.example/db",
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      NODE_ENV: "production",
      ...vercelEnvironment,
    };

    expect(() => getServerEnv()).toThrow(
      "E2E_TEST_MODE must not be enabled in a Vercel runtime."
    );
  });

  it("does not let E2E mode bypass production checks outside loopback", () => {
    process.env = {
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production",
      BETTER_AUTH_URL: "https://app.example.com",
      CERTIFICATE_PUBLIC_BASE_URL: "https://app.example.com",
      CI: "true",
      DATABASE_URL: "postgresql://e2e.example/db",
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NODE_ENV: "production",
    };

    expect(() => getServerEnv()).toThrow(
      "E2E_TEST_MODE requires loopback application URLs."
    );
  });

  it("rejects direct database credentials in the production E2E web runtime", () => {
    process.env = {
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
      CI: "true",
      DATABASE_URL: "postgresql://e2e.example/db",
      DATABASE_URL_DIRECT: "postgresql://direct.example/db",
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      NODE_ENV: "production",
    };

    expect(() => getServerEnv()).toThrow(
      "DATABASE_URL_DIRECT must not be set in the web runtime"
    );
  });

  it("rejects an incomplete production web runtime", () => {
    setEnv("NODE_ENV", "production");
    setEnv("BETTER_AUTH_SECRET", "production-secret");
    setEnv("BETTER_AUTH_URL", "https://app.example.com");
    setEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    setEnv("CERTIFICATE_PUBLIC_BASE_URL", "https://app.example.com");
    setEnv("DATABASE_URL", undefined);

    expect(() => getServerEnv()).toThrow(DATABASE_URL_ERROR_PATTERN);
  });
});

describe("isolated E2E runtime guard", () => {
  it("accepts only the explicitly configured shared 127.0.0.1 origin", () => {
    expect(isIsolatedE2eRuntime(STRICT_E2E_ENVIRONMENT)).toBe(true);
  });

  it.each([
    ["CI", "false"],
    ["E2E_TEST_MODE", "false"],
    ["BETTER_AUTH_URL", undefined],
    ["CERTIFICATE_PUBLIC_BASE_URL", "http://localhost:3100"],
    ["NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3200"],
    ["VERCEL_ENV", "production"],
    ["VERCEL_ENV", "preview"],
    ["VERCEL_TARGET_ENV", "staging"],
  ] as const)("rejects an invalid %s dimension", (key, value) => {
    expect(
      isIsolatedE2eRuntime({
        ...STRICT_E2E_ENVIRONMENT,
        [key]: value,
      })
    ).toBe(false);
  });
});
