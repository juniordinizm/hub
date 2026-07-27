import { describe, expect, it } from "vitest";
import { shouldInstallGitHooks } from "./git-hooks-install-policy";

describe("Git hook installation policy", () => {
  it("installs hooks only for a local checkout with Git metadata", () => {
    expect(
      shouldInstallGitHooks({
        ci: false,
        gitMetadataExists: true,
        vercel: false,
      })
    ).toBe(true);
  });

  it("skips hooks in CI, Vercel, and source archives without Git metadata", () => {
    expect(
      shouldInstallGitHooks({
        ci: true,
        gitMetadataExists: true,
        vercel: false,
      })
    ).toBe(false);
    expect(
      shouldInstallGitHooks({
        ci: false,
        gitMetadataExists: true,
        vercel: true,
      })
    ).toBe(false);
    expect(
      shouldInstallGitHooks({
        ci: false,
        gitMetadataExists: false,
        vercel: false,
      })
    ).toBe(false);
  });
});
