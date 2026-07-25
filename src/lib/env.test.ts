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
