import { describe, expect, it } from "vitest";
import { resolveRuntimeEnvironment } from "./runtime-environment";

describe("resolveRuntimeEnvironment", () => {
  it("gives the custom Staging target precedence over Preview type", () => {
    expect(
      resolveRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "staging",
      })
    ).toBe("staging");
  });

  it("keeps ordinary Vercel previews isolated", () => {
    expect(
      resolveRuntimeEnvironment({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      })
    ).toBe("preview");
  });

  it("distinguishes E2E, Production, and Development", () => {
    expect(
      resolveRuntimeEnvironment({ CI: "true", E2E_TEST_MODE: "true" })
    ).toBe("e2e");
    expect(resolveRuntimeEnvironment({ NODE_ENV: "production" })).toBe(
      "production"
    );
    expect(resolveRuntimeEnvironment({ NODE_ENV: "development" })).toBe(
      "development"
    );
  });
});
