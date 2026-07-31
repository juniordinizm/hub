import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

const DATABASE_URL_ERROR_PATTERN = /DATABASE_URL/;

const ORIGINAL_ENV = { ...process.env };

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

  it.each([
    "development",
    "test",
  ] as const)("keeps the legacy AbacatePay webhook enabled by default in %s", (nodeEnvironment) => {
    setEnv("ABACATEPAY_WEBHOOK_ENABLED", undefined);
    setEnv("NODE_ENV", nodeEnvironment);
    setEnv("VERCEL_ENV", undefined);

    expect(getServerEnv().ABACATEPAY_WEBHOOK_ENABLED).toBe(true);
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
    expect(env.ABACATEPAY_WEBHOOK_ENABLED).toBe(false);
    expect(env.PAYMENTS_CHECKOUT_MODE).toBe("disabled");
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

  it("keeps public sign-up disabled by default", () => {
    setEnv("NODE_ENV", "development");
    setEnv("AUTH_PUBLIC_SIGNUP_ENABLED", undefined);

    expect(getServerEnv().AUTH_PUBLIC_SIGNUP_ENABLED).toBe(false);
  });

  it("only permits E2E mode in CI", () => {
    setEnv("NODE_ENV", "development");
    setEnv("E2E_TEST_MODE", "true");
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
