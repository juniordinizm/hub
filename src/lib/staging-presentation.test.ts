import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagingPresentation } from "./staging-presentation";

describe("Staging presentation", () => {
  it("marks Staging as non-indexable", () => {
    expect(getStagingPresentation({ VERCEL_TARGET_ENV: "staging" })).toEqual({
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      isStaging: true,
      robots: { follow: false, index: false },
    });
  });

  it("does not change non-Staging presentation", () => {
    expect(getStagingPresentation({ VERCEL_TARGET_ENV: "preview" })).toEqual({
      headers: [],
      isStaging: false,
    });
  });

  it("wires metadata, banner, and response headers into the application", () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8"
    );
    const bannerSource = readFileSync(
      resolve(process.cwd(), "src/components/environment/staging-banner.tsx"),
      "utf8"
    );
    const configSource = readFileSync(
      resolve(process.cwd(), "next.config.ts"),
      "utf8"
    );

    expect(layoutSource).toContain("<StagingBanner />");
    expect(layoutSource).toContain("robots: stagingPresentation.robots");
    expect(bannerSource).toContain("Ambiente de homologação");
    expect(configSource).toContain("...stagingPresentation.headers");
  });
});
