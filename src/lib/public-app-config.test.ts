import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getPublicAppUrl } from "./public-app-config";

describe("public app configuration", () => {
  it("requires the canonical public URL in production", () => {
    expect(() =>
      getPublicAppUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: undefined,
      })
    ).toThrow("NEXT_PUBLIC_APP_URL is required in production.");
  });

  it("returns the canonical public URL without loading server secrets", () => {
    expect(
      getPublicAppUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.example.com",
      })
    ).toBe("https://app.example.com");
  });

  it("derives the canonical URL from the protected Preview branch alias", () => {
    expect(
      getPublicAppUrl({
        NODE_ENV: "production",
        VERCEL_BRANCH_URL: "hub-git-feature-neuro-capacitar.vercel.app",
        VERCEL_ENV: "preview",
        VERCEL_URL: "hub-random-deployment.vercel.app",
      })
    ).toBe("https://hub-git-feature-neuro-capacitar.vercel.app");
  });

  it("does not use a generated Vercel URL as the Production origin", () => {
    expect(() =>
      getPublicAppUrl({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        VERCEL_URL: "hub-neuro-capacitar.vercel.app",
      })
    ).toThrow("NEXT_PUBLIC_APP_URL is required in production.");
  });

  it("uses localhost only outside production", () => {
    expect(
      getPublicAppUrl({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: undefined,
      })
    ).toBe("http://localhost:3000");
  });

  it("keeps the root metadata independent from server secrets", async () => {
    const layoutSource = await readFile(
      new URL("../app/layout.tsx", import.meta.url),
      "utf8"
    );

    expect(layoutSource).toContain("getPublicAppUrl");
    expect(layoutSource).not.toContain("getServerEnv");
  });
});
