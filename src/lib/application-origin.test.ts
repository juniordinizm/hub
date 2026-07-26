import { describe, expect, it } from "vitest";
import { resolveCanonicalApplicationEnvironment } from "./application-origin";

describe("canonical application origin", () => {
  it("prefers the protected branch alias in Preview", () => {
    const environment = resolveCanonicalApplicationEnvironment({
      VERCEL_BRANCH_URL: "hub-git-feature.vercel.app",
      VERCEL_ENV: "preview",
      VERCEL_URL: "hub-random-deployment.vercel.app",
    });

    expect(environment.NEXT_PUBLIC_APP_URL).toBe(
      "https://hub-git-feature.vercel.app"
    );
    expect(environment.BETTER_AUTH_URL).toBe(
      "https://hub-git-feature.vercel.app"
    );
    expect(environment.CERTIFICATE_PUBLIC_BASE_URL).toBe(
      "https://hub-git-feature.vercel.app"
    );
  });

  it("never derives a Production origin from a Vercel hostname", () => {
    const environment = resolveCanonicalApplicationEnvironment({
      VERCEL_BRANCH_URL: "hub-git-main.vercel.app",
      VERCEL_ENV: "production",
      VERCEL_URL: "hub-production.vercel.app",
    });

    expect(environment.NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(environment.BETTER_AUTH_URL).toBeUndefined();
    expect(environment.CERTIFICATE_PUBLIC_BASE_URL).toBeUndefined();
  });
});
