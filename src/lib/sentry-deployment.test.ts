import { describe, expect, it } from "vitest";
import {
  resolveSentryBuildConfiguration,
  resolveSentryRelease,
} from "./sentry-deployment";

describe("Sentry deployment configuration", () => {
  it("uses one validated organization, project and full deployment SHA", () => {
    const release = "a".repeat(40);
    expect(
      resolveSentryBuildConfiguration({
        SENTRY_AUTH_TOKEN: "configured-without-being-returned",
        SENTRY_ORG: "neurocapacitar",
        SENTRY_PROJECT: "hub-development",
        VERCEL_GIT_COMMIT_SHA: release,
      })
    ).toEqual({
      org: "neurocapacitar",
      project: "hub-development",
      release,
      uploadSourceMaps: true,
    });
  });

  it("fails closed when upload configuration is incomplete", () => {
    expect(() =>
      resolveSentryBuildConfiguration({
        SENTRY_AUTH_TOKEN: "configured",
        SENTRY_ORG: "neurocapacitar",
        VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      })
    ).toThrow(
      "SENTRY_PROJECT is required when SENTRY_AUTH_TOKEN is configured."
    );
  });

  it("derives runtime release only from full SHA candidates", () => {
    expect(
      resolveSentryRelease({
        GITHUB_SHA: "b".repeat(40),
        SENTRY_RELEASE: "invalid-short-sha",
      })
    ).toBe("b".repeat(40));
    expect(resolveSentryRelease({ SENTRY_RELEASE: "abc1234" })).toBeUndefined();
  });
});
