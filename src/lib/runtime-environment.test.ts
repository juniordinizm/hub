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

  it.each([
    [
      "Production",
      { NODE_ENV: "production", VERCEL_ENV: "production" },
      "production",
    ],
    ["Preview", { NODE_ENV: "production", VERCEL_ENV: "preview" }, "preview"],
    [
      "Staging",
      {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "staging",
      },
      "staging",
    ],
  ] as const)("gives Vercel %s precedence over E2E flags", (_name, environment, expected) => {
    expect(
      resolveRuntimeEnvironment({
        ...environment,
        CI: "true",
        E2E_TEST_MODE: "true",
      })
    ).toBe(expected);
  });
});
