import { describe, expect, it } from "vitest";
import {
  parseCertificateRenderSnapshot,
  parseCertificateTemplateDraft,
} from "./render-snapshot";
import { CertificateTemplateValidationError } from "./template-errors";

const field = {
  align: "center",
  color: "#1a1a1a",
  field: "studentName",
  font: "Helvetica-Bold",
  fontSize: 24,
  height: 10,
  visible: true,
  width: 80,
  x: 10,
  y: 30,
};

const validDraft = {
  backgroundKey: "certificates/templates/course/arte.webp",
  fields: [field],
};

describe("parseCertificateTemplateDraft", () => {
  it.each([
    "not-json",
    { backgroundKey: "", fields: [] },
    { ...validDraft, unknown: true },
    { ...validDraft, fields: [{ ...field, field: "unknown" }] },
    { ...validDraft, fields: [field, field] },
    { ...validDraft, fields: [{ ...field, color: "red" }] },
  ])("rejects malformed template input", (value) => {
    expect(() => parseCertificateTemplateDraft(value)).toThrow(
      CertificateTemplateValidationError
    );
  });

  it("parses a valid draft into a safe template contract", () => {
    expect(parseCertificateTemplateDraft(JSON.stringify(validDraft))).toEqual(
      validDraft
    );
  });
});

describe("parseCertificateRenderSnapshot", () => {
  it("rejects an incomplete immutable snapshot", () => {
    expect(() => parseCertificateRenderSnapshot({})).toThrow(
      CertificateTemplateValidationError
    );
  });

  it("parses a complete immutable snapshot", () => {
    const snapshot = parseCertificateRenderSnapshot({
      certificate: { code: "CERT-123", issuedAt: "2026-07-22T12:00:00.000Z" },
      completion: { completedAt: "2026-07-21T12:00:00.000Z" },
      course: { title: "Curso", workloadHours: 10 },
      issuer: {
        cnpj: "12.345.678/0001-90",
        courseFreeStatement: "Curso livre.",
        displayName: "Hub",
        legalName: "Hub Educacao LTDA",
      },
      student: { name: "Ana" },
      template: {
        backgroundKey: validDraft.backgroundKey,
        fields: validDraft.fields,
        id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
        signatureKey: null,
        signerName: null,
        signerRole: null,
        version: 1,
      },
      version: 1,
    });

    expect(snapshot.issuer.displayName).toBe("Hub");
  });
});
