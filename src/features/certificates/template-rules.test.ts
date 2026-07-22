import { describe, expect, it } from "vitest";
import { validateCertificateTemplate } from "./template-rules";

const required = [
  "studentName",
  "courseTitle",
  "issuerName",
  "validationCode",
  "qrCode",
] as const;

describe("certificate template rules", () => {
  it("rejects a field outside the printable page", () => {
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: required.map((field, index) => ({
          align: "left",
          color: "#000000",
          field,
          fontSize: 12,
          height: 10,
          visible: true,
          width: 30,
          x: index === 0 ? 80 : 0,
          y: 0,
        })),
      })
    ).toContain("O campo studentName esta fora da area imprimivel.");
  });
  it("rejects overlapping visible fields", () => {
    const fields = required.map((field) => ({
      align: "left" as const,
      color: "#000",
      field,
      fontSize: 12,
      height: 10,
      visible: true,
      width: 30,
      x: 0,
      y: 0,
    }));
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields,
      })
    ).toContain("Os campos studentName e courseTitle se sobrepoem.");
  });

  it("requires every standard field needed to validate a certificate", () => {
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: [],
      })
    ).toContain("O campo studentName e obrigatorio.");
  });

  it("rejects a font outside the approved rendering set", () => {
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: required.map((field, index) => ({
          align: "left" as const,
          color: "#000000",
          field,
          ...(index === 0 ? { font: "Comic Sans" as never } : {}),
          fontSize: 12,
          height: 4,
          visible: true,
          width: 15,
          x: index * 16,
          y: 0,
        })),
      })
    ).toContain("A fonte do campo studentName nao e permitida.");
  });

  it("rejects an invalid color and font size", () => {
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: required.map((field, index) => ({
          align: "left" as const,
          color: index === 0 ? "blue" : "#000000",
          field,
          fontSize: index === 0 ? 80 : 12,
          height: 4,
          visible: true,
          width: 15,
          x: index * 16,
          y: 0,
        })),
      })
    ).toEqual(
      expect.arrayContaining([
        "A cor do campo studentName nao e permitida.",
        "O tamanho do campo studentName esta fora do limite.",
      ])
    );
  });
});
