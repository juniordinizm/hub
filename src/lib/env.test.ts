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

  it("keeps public sign-up disabled by default", () => {
    setEnv("NODE_ENV", "development");
    setEnv("AUTH_PUBLIC_SIGNUP_ENABLED", undefined);

    expect(getServerEnv().AUTH_PUBLIC_SIGNUP_ENABLED).toBe(false);
  });
});
