export const CERTIFICATE_PAGE = { height: 210, width: 297 } as const;

export const CERTIFICATE_FIELDS = [
  "studentName",
  "courseTitle",
  "workloadHours",
  "completedAt",
  "issuedAt",
  "issuerName",
  "issuerCnpj",
  "signerName",
  "signerRole",
  "signatureImage",
  "validationCode",
  "qrCode",
] as const;

export type CertificateField = (typeof CERTIFICATE_FIELDS)[number];

export interface CertificateTemplateField {
  align: "center" | "left" | "right";
  color: string;
  field: CertificateField;
  font?: "Helvetica" | "Helvetica-Bold";
  fontSize: number;
  height: number;
  /** Optional in the TypeScript boundary so legacy drafts can be normalized. */
  verticalAlign?: "top" | "middle" | "bottom";
  visible: boolean;
  width: number;
  x: number;
  y: number;
}

export interface CertificateTemplateSpec {
  backgroundKey: string;
  fields: CertificateTemplateField[];
}

export interface CertificateTemplateOverlap {
  fields: [CertificateField, CertificateField];
}

export const createDefaultCertificateTemplateFields =
  (): CertificateTemplateField[] =>
    CERTIFICATE_FIELDS.map((field, index) => ({
      align: "center",
      color: "#17292b",
      field,
      font: field === "studentName" ? "Helvetica-Bold" : "Helvetica",
      fontSize: field === "studentName" ? 24 : 10,
      height: field === "qrCode" ? 12 : 5,
      visible: !(
        field === "signatureImage" ||
        field === "signerName" ||
        field === "signerRole"
      ),
      width: field === "qrCode" ? 12 : 70,
      x: field === "qrCode" ? 82 : 15,
      // Keep every default field inside the printable area, including the
      // 12%-high QR field at the bottom of the page.
      y: 8 + index * 6,
      verticalAlign: "middle",
    }));

/**
 * Keeps older editable templates compatible when a new canonical field is
 * introduced. Existing field settings and order are preserved; only missing
 * canonical fields are appended with their safe defaults. An empty legacy
 * draft is recovered with the complete default field set.
 */
export const ensureCertificateTemplateFields = (
  fields: CertificateTemplateField[]
): CertificateTemplateField[] => {
  if (fields.length === 0) {
    return createDefaultCertificateTemplateFields();
  }

  const existingFields = new Set(fields.map((field) => field.field));
  const missingFields = createDefaultCertificateTemplateFields().filter(
    (field) => !existingFields.has(field.field)
  );
  return missingFields.length > 0 ? [...fields, ...missingFields] : fields;
};

export const CERTIFICATE_REQUIRED_FIELDS = [
  "studentName",
  "validationCode",
  "qrCode",
] as const satisfies readonly CertificateField[];

const requiredFields = new Set<CertificateField>(CERTIFICATE_REQUIRED_FIELDS);

export const isRequiredCertificateField = (field: CertificateField): boolean =>
  requiredFields.has(field);

const hexColorPattern = /^#[0-9a-f]{6}$/i;

const validateField = (item: CertificateTemplateField): string[] => {
  const errors: string[] = [];
  if (
    item.x < 0 ||
    item.y < 0 ||
    item.width <= 0 ||
    item.height <= 0 ||
    item.x + item.width > 100 ||
    item.y + item.height > 100
  ) {
    errors.push(`O campo ${item.field} esta fora da area imprimivel.`);
  }
  if (
    item.font &&
    !(item.font === "Helvetica" || item.font === "Helvetica-Bold")
  ) {
    errors.push(`A fonte do campo ${item.field} nao e permitida.`);
  }
  if (!hexColorPattern.test(item.color)) {
    errors.push(`A cor do campo ${item.field} nao e permitida.`);
  }
  if (item.fontSize < 6 || item.fontSize > 72) {
    errors.push(`O tamanho do campo ${item.field} esta fora do limite.`);
  }
  return errors;
};

export const findCertificateTemplateOverlaps = (
  fields: CertificateTemplateField[]
): CertificateTemplateOverlap[] => {
  const overlaps: CertificateTemplateOverlap[] = [];
  const visibleFields = fields.filter((item) => item.visible);
  for (let index = 0; index < visibleFields.length; index += 1) {
    const left = visibleFields[index];
    if (!left) {
      continue;
    }
    for (const right of visibleFields.slice(index + 1)) {
      const overlapsFound =
        left.x < right.x + right.width &&
        left.x + left.width > right.x &&
        left.y < right.y + right.height &&
        left.y + left.height > right.y;
      if (overlapsFound) {
        overlaps.push({ fields: [left.field, right.field] });
      }
    }
  }
  return overlaps;
};

export const validateCertificateTemplate = (
  spec: CertificateTemplateSpec
): string[] => {
  const errors: string[] = [];
  if (!spec.backgroundKey.trim()) {
    errors.push("Envie a arte de fundo A4.");
  }
  const seen = new Set<CertificateField>();
  for (const item of spec.fields) {
    if (seen.has(item.field)) {
      errors.push(`O campo ${item.field} foi duplicado.`);
    }
    seen.add(item.field);
    errors.push(...validateField(item));
  }
  for (const field of requiredFields) {
    if (!spec.fields.some((item) => item.field === field && item.visible)) {
      errors.push(`O campo ${field} e obrigatorio.`);
    }
  }
  return errors;
};
