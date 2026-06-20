import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv } from "./env";

describe("server environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a development auth secret only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    expect(getServerEnv().BETTER_AUTH_SECRET).toBe(
      "development-secret-change-me"
    );
  });

  it("requires an explicit auth secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");

    expect(() => getServerEnv()).toThrow(
      "BETTER_AUTH_SECRET is required in production."
    );
  });
});
