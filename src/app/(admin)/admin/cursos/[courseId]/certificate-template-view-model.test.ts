import { describe, expect, it } from "vitest";
import { getCertificateEditorStatus } from "./certificate-template-view-model";

describe("getCertificateEditorStatus", () => {
  it("distinguishes disabled, draft, active, and active with changes", () => {
    expect(
      getCertificateEditorStatus({
        certificateEnabled: false,
        hasDraft: false,
        hasPublished: false,
      })
    ).toEqual({ label: "Desligado", tone: "secondary" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: false,
        hasDraft: true,
        hasPublished: false,
      })
    ).toEqual({ label: "Rascunho", tone: "secondary" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: false,
        hasPublished: true,
      })
    ).toEqual({ label: "Ativo", tone: "default" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: true,
        hasPublished: true,
      })
    ).toEqual({ label: "Ativo + alterações", tone: "outline" });
  });

  it("never presents an enabled course without a published template as active", () => {
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: true,
        hasPublished: false,
      }).label
    ).toBe("Configuração incompleta");
  });
});
