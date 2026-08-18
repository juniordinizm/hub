import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CertificatePublicActions } from "./certificate-public-actions";

describe("CertificatePublicActions", () => {
  it("exposes an accessible live region for clipboard feedback", () => {
    const markup = renderToStaticMarkup(
      <CertificatePublicActions
        code="PRT-READY"
        pdfHref="/certificados/PRT-READY/pdf"
      />
    );

    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('role="status"');
  });
});
