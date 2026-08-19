import { z } from "zod";
import { CERTIFICATE_REASON_CODES } from "@/features/certificates/reasons";

const requiredString = (message: string) => z.string().trim().min(1, message);

const certificateReasonSchema = z.enum(CERTIFICATE_REASON_CODES, {
  error: "Informe uma categoria de motivo valida.",
});

const certificateOperationConfirmationSchema = z.literal("yes", {
  error: "Confirme esta operacao de certificado.",
});

const issueCertificateSchema = z.object({
  confirmed: certificateOperationConfirmationSchema,
  courseId: requiredString("Informe o curso."),
  reasonCategory: certificateReasonSchema,
  reasonDetail: requiredString("Informe o detalhe interno do motivo."),
  userId: requiredString("Informe a aluna."),
});

const changeCertificateSchema = z.object({
  certificateId: requiredString("Informe o certificado."),
  confirmed: certificateOperationConfirmationSchema,
  reasonCategory: certificateReasonSchema,
  reasonDetail: requiredString("Informe o detalhe interno do motivo."),
});

const reconcileHistoricalCertificatesSchema = z.object({
  confirmed: z.literal("yes", {
    error: "Confirme a emissao dos certificados pendentes.",
  }),
  courseId: requiredString("Informe o curso."),
});

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "");

export const parseIssueManualCertificateInput = (formData: FormData) =>
  issueCertificateSchema.parse({
    confirmed: readString(formData, "confirmed"),
    courseId: readString(formData, "courseId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
    userId: readString(formData, "userId"),
  });

export const parseChangeCertificateInput = (formData: FormData) =>
  changeCertificateSchema.parse({
    certificateId: readString(formData, "certificateId"),
    confirmed: readString(formData, "confirmed"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
  });

export const parseReconcileHistoricalCertificatesInput = (formData: FormData) =>
  reconcileHistoricalCertificatesSchema.parse({
    confirmed: readString(formData, "confirmed"),
    courseId: readString(formData, "courseId"),
  });
