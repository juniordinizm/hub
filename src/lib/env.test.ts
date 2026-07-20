import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

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

  it("keeps destructive retention disabled by default", () => {
    setEnv("NODE_ENV", "development");
    setEnv("DATA_RETENTION_ENABLED", undefined);

    expect(getServerEnv().DATA_RETENTION_ENABLED).toBe(false);
  });

  it("requires a legal approval reference before enabling retention", () => {
    setEnv("NODE_ENV", "development");
    setEnv("DATA_RETENTION_ENABLED", "true");
    setEnv("LEGAL_APPROVAL_REFERENCE", undefined);

    expect(() => getServerEnv()).toThrow(
      "LEGAL_APPROVAL_REFERENCE is required when DATA_RETENTION_ENABLED is true."
    );
  });
});
