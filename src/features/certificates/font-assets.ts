import { resolve } from "node:path";
import type { CertificateTemplateField } from "./template-rules";

const certificateFontDirectory = resolve(
  process.cwd(),
  "public/fonts/certificates"
);

export const CERTIFICATE_FONT_FAMILY = "Inter" as const;

export const CERTIFICATE_FONT_FILES = {
  bold: resolve(certificateFontDirectory, "Inter-Bold.ttf"),
  config: resolve(certificateFontDirectory, "fonts.conf"),
  directory: certificateFontDirectory,
  license: resolve(certificateFontDirectory, "OFL.txt"),
  regular: resolve(certificateFontDirectory, "Inter-Regular.ttf"),
} as const;

export const getCertificateFontFile = (
  font: CertificateTemplateField["font"]
): string =>
  font === "Helvetica-Bold"
    ? CERTIFICATE_FONT_FILES.bold
    : CERTIFICATE_FONT_FILES.regular;

export const configureCertificateFontRuntime = (): void => {
  process.env.FONTCONFIG_FILE = CERTIFICATE_FONT_FILES.config;
  process.env.FONTCONFIG_PATH = CERTIFICATE_FONT_FILES.directory;
};
