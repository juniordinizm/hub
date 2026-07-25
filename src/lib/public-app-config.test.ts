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
