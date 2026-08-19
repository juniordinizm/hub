import { describe, expect, it } from "vitest";
import {
  createDefaultCertificateTemplateFields,
  findCertificateTemplateOverlaps,
  validateCertificateTemplate,
} from "./template-rules";

const required = [
  "studentName",
  "courseTitle",
  "issuerName",
  "validationCode",
  "qrCode",
] as const;

const makeRequiredFields = (
  overrides: Partial<
    Record<
      (typeof required)[number],
      Partial<{
        height: number;
        visible: boolean;
        width: number;
        x: number;
        y: number;
      }>
    >
  > = {}
) =>
  required.map((field, index) => ({
    align: "left" as const,
    color: "#000000",
    field,
    font: "Helvetica" as const,
    fontSize: 12,
    height: 4,
    visible: true,
    width: 15,
    x: index * 16,
    y: 20,
    ...overrides[field],
  }));

describe("certificate template rules", () => {
  it("creates a valid default template", () => {
    expect(
      createDefaultCertificateTemplateFields().every(
        (field) => field.verticalAlign === "middle"
      )
    ).toBe(true);
    expect(
      validateCertificateTemplate({
        backgroundKey: "certificates/a4.png",
        fields: createDefaultCertificateTemplateFields(),
      })
    ).toEqual([]);
  });

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
  it("reports overlapping visible fields without blocking validation", () => {
    const fields = makeRequiredFields({
      studentName: { height: 10, width: 40, x: 0, y: 0 },
      courseTitle: { height: 10, width: 40, x: 20, y: 0 },
    });
    const spec = {
      backgroundKey: "certificates/a4.png",
      fields,
    };

    expect(findCertificateTemplateOverlaps(fields)).toEqual([
      { fields: ["studentName", "courseTitle"] },
    ]);
    expect(validateCertificateTemplate(spec)).not.toContain(
      "Os campos studentName e courseTitle se sobrepoem."
    );
  });

  it("ignores hidden fields when reporting overlaps", () => {
    const fields = makeRequiredFields({
      studentName: { height: 10, width: 40, x: 0, y: 0 },
      courseTitle: { height: 10, visible: false, width: 40, x: 20, y: 0 },
    });

    expect(findCertificateTemplateOverlaps(fields)).toEqual([]);
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
