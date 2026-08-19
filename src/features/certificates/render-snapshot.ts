import { z } from "zod";
import { CertificateTemplateValidationError } from "./template-errors";
import {
  CERTIFICATE_FIELDS,
  type CertificateTemplateField,
  type CertificateTemplateSpec,
} from "./template-rules";

type VerticalAlign = "top" | "middle" | "bottom";

const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const createFieldSchema = <Fields extends readonly [string, ...string[]]>(
  fields: Fields
) =>
  z
    .object({
      align: z.enum(["center", "left", "right"]),
      color: colorSchema,
      field: z.enum(fields),
      font: z.enum(["Helvetica", "Helvetica-Bold"]).optional(),
      fontSize: z.number().finite().min(6).max(72),
      height: z.number().finite().positive().max(100),
      visible: z.boolean(),
      width: z.number().finite().positive().max(100),
      x: z.number().finite().min(0).max(100),
      y: z.number().finite().min(0).max(100),
      verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
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

const createFieldsSchema = <FieldSchema extends z.ZodType<{ field: string }>>(
  fieldSchema: FieldSchema
) =>
  z
    .array(fieldSchema)
    .min(1)
    .superRefine((fields, context) => {
      const usedFields = new Set<string>();

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

const fieldSchema = createFieldSchema(CERTIFICATE_FIELDS);
const fieldsSchema = createFieldsSchema(fieldSchema);
const renderFieldSchema = createFieldSchema([
  ...CERTIFICATE_FIELDS,
  "courseFreeStatement",
] as const);
const renderFieldsSchema = createFieldsSchema(renderFieldSchema);

const certificateTemplateSubmissionSchema = z
  .object({
    backgroundKey: z.string().trim(),
    fields: fieldsSchema,
  })
  .strict();

const certificateTemplateDraftSchema = certificateTemplateSubmissionSchema
  .extend({
    backgroundKey: z.string().trim().min(1),
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
        // Kept only so immutable certificates created before the removal of
        // the course-free field remain readable. New snapshots never write it.
        courseFreeStatement: z.string().trim().min(1).optional(),
        displayName: z.string().trim().min(1),
        legalName: z.string().trim().min(1),
      })
      .strict(),
    student: z.object({ name: z.string().trim().min(1) }).strict(),
    template: z
      .object({
        backgroundKey: z.string().trim().min(1),
        // Legacy template snapshots may contain this value. Workload now
        // comes exclusively from the effective course workload.
        certificateWorkloadHours: z
          .number()
          .int()
          .nonnegative()
          .nullable()
          .optional(),
        fields: renderFieldsSchema,
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

const removeLegacyCertificateFields = (value: unknown): unknown => {
  const parsed = parseInput(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const candidate = parsed as { fields?: unknown };
  if (!Array.isArray(candidate.fields)) {
    return parsed;
  }

  return {
    ...candidate,
    fields: candidate.fields.filter(
      (field) =>
        !(
          field &&
          typeof field === "object" &&
          "field" in field &&
          (field as { field?: unknown }).field === "courseFreeStatement"
        )
    ),
  };
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

const normalizeFields = <
  Field extends { verticalAlign?: VerticalAlign | undefined },
>(
  fields: Field[]
): Array<Omit<Field, "verticalAlign"> & { verticalAlign: VerticalAlign }> =>
  fields.map((field) => ({
    ...field,
    verticalAlign: field.verticalAlign ?? "middle",
  }));

export const parseCertificateTemplateDraft = (
  value: unknown
): CertificateTemplateSpec => {
  const parsed = parseOrThrow(
    certificateTemplateDraftSchema,
    removeLegacyCertificateFields(value),
    "Template invalido."
  ) as {
    backgroundKey: string;
    fields: CertificateTemplateField[];
  };
  return { ...parsed, fields: normalizeFields(parsed.fields) };
};

export const parseCertificateTemplateSubmission = (
  value: unknown
): CertificateTemplateSpec => {
  const parsed = parseOrThrow(
    certificateTemplateSubmissionSchema,
    value,
    "Template invalido."
  ) as {
    backgroundKey: string;
    fields: CertificateTemplateField[];
  };
  return { ...parsed, fields: normalizeFields(parsed.fields) };
};

export const parseCertificateRenderSnapshot = (
  value: unknown
): CertificateRenderSnapshot => {
  const parsed = parseOrThrow(
    certificateRenderSnapshotSchema,
    value,
    "Snapshot de certificado invalido."
  );
  return {
    ...parsed,
    template: {
      ...parsed.template,
      fields: normalizeFields(parsed.template.fields),
    },
  };
};
