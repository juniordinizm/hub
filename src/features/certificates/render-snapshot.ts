import { z } from "zod";
import {
  CERTIFICATE_FIELDS,
  type CertificateField,
  type CertificateTemplateField,
  type CertificateTemplateSpec,
} from "./template-rules";

const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const fieldSchema = z
  .object({
    align: z.enum(["center", "left", "right"]),
    color: colorSchema,
    field: z.enum(CERTIFICATE_FIELDS),
    font: z.enum(["Helvetica", "Helvetica-Bold"]).optional(),
    fontSize: z.number().finite().min(6).max(72),
    height: z.number().finite().positive().max(100),
    visible: z.boolean(),
    width: z.number().finite().positive().max(100),
    x: z.number().finite().min(0).max(100),
    y: z.number().finite().min(0).max(100),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.x + field.width > 100 || field.y + field.height > 100) {
      context.addIssue({
        code: "custom",
        message: "O campo esta fora da area imprimivel.",
      });
    }
  });

const fieldsSchema = z
  .array(fieldSchema)
  .min(1)
  .superRefine((fields, context) => {
    const usedFields = new Set<CertificateField>();

    for (const [index, field] of fields.entries()) {
      if (usedFields.has(field.field)) {
        context.addIssue({
          code: "custom",
          message: `O campo ${field.field} foi duplicado.`,
          path: [index, "field"],
        });
      }
      usedFields.add(field.field);
    }
  });

const certificateTemplateDraftSchema = z
  .object({
    backgroundKey: z.string().trim().min(1),
    fields: fieldsSchema,
  })
  .strict();

const certificateRenderSnapshotSchema = z
  .object({
    certificate: z
      .object({
        code: z.string().trim().min(1),
        issuedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    completion: z
      .object({ completedAt: z.string().datetime({ offset: true }) })
      .strict(),
    course: z
      .object({
        title: z.string().trim().min(1),
        workloadHours: z.number().int().nonnegative(),
      })
      .strict(),
    issuer: z
      .object({
        cnpj: z.string().trim().min(1),
        courseFreeStatement: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        legalName: z.string().trim().min(1),
      })
      .strict(),
    student: z.object({ name: z.string().trim().min(1) }).strict(),
    template: z
      .object({
        backgroundKey: z.string().trim().min(1),
        fields: fieldsSchema,
        id: z.string().uuid(),
        signatureKey: z.string().trim().min(1).nullable(),
        signerName: z.string().trim().min(1).nullable(),
        signerRole: z.string().trim().min(1).nullable(),
        version: z.number().int().positive(),
      })
      .strict(),
    version: z.literal(1),
  })
  .strict();

export type CertificateRenderSnapshot = z.infer<
  typeof certificateRenderSnapshotSchema
>;

export class CertificateTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateTemplateValidationError";
  }
}

const parseInput = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CertificateTemplateValidationError(
      "O template de certificado nao contem JSON valido."
    );
  }
};

const parseOrThrow = <Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  message: string
): z.infer<Schema> => {
  const result = schema.safeParse(parseInput(value));

  if (!result.success) {
    throw new CertificateTemplateValidationError(
      result.error.issues[0]?.message ?? message
    );
  }

  return result.data;
};

export const parseCertificateTemplateDraft = (
  value: unknown
): CertificateTemplateSpec =>
  parseOrThrow(certificateTemplateDraftSchema, value, "Template invalido.") as {
    backgroundKey: string;
    fields: CertificateTemplateField[];
  };

export const parseCertificateRenderSnapshot = (
  value: unknown
): CertificateRenderSnapshot =>
  parseOrThrow(
    certificateRenderSnapshotSchema,
    value,
    "Snapshot de certificado invalido."
  );
