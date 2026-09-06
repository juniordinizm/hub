import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_FONT_FAMILY,
  CERTIFICATE_FONT_FILES,
  configureCertificateFontRuntime,
  getCertificateFontFile,
} from "./font-assets";

describe("certificate font assets", () => {
  it("ships both static Inter weights and the Fontconfig file", () => {
    expect(existsSync(CERTIFICATE_FONT_FILES.regular)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.bold)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.config)).toBe(true);
    expect(existsSync(CERTIFICATE_FONT_FILES.license)).toBe(true);
  });

  it("keeps the persisted aliases mapped to the correct Inter files", () => {
    expect(CERTIFICATE_FONT_FAMILY).toBe("Inter");
    expect(
      getCertificateFontFile("Helvetica").endsWith("Inter-Regular.ttf")
    ).toBe(true);
    expect(getCertificateFontFile("Helvetica")).toBe(
      CERTIFICATE_FONT_FILES.regular
    );
    expect(
      getCertificateFontFile("Helvetica-Bold").endsWith("Inter-Bold.ttf")
    ).toBe(true);
    expect(getCertificateFontFile("Helvetica-Bold")).toBe(
      CERTIFICATE_FONT_FILES.bold
    );
    expect(
      getCertificateFontFile(undefined).endsWith("Inter-Regular.ttf")
    ).toBe(true);
    expect(getCertificateFontFile(undefined)).toBe(
      CERTIFICATE_FONT_FILES.regular
    );
  });

  it("configures Fontconfig from the bundled certificate assets", () => {
    const previousFontconfigFile = process.env.FONTCONFIG_FILE;
    const previousFontconfigPath = process.env.FONTCONFIG_PATH;

    try {
      configureCertificateFontRuntime();
      expect(process.env.FONTCONFIG_FILE).toBe(CERTIFICATE_FONT_FILES.config);
      expect(process.env.FONTCONFIG_PATH).toBe(
        CERTIFICATE_FONT_FILES.directory
      );
      expect(readFileSync(CERTIFICATE_FONT_FILES.config, "utf8")).toContain(
        'prefix="relative"'
      );
    } finally {
      if (previousFontconfigFile === undefined) {
        delete process.env.FONTCONFIG_FILE;
      } else {
        process.env.FONTCONFIG_FILE = previousFontconfigFile;
      }

      if (previousFontconfigPath === undefined) {
        delete process.env.FONTCONFIG_PATH;
      } else {
        process.env.FONTCONFIG_PATH = previousFontconfigPath;
      }
    }
  });
});
