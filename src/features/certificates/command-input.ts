import { z } from "zod";
import { CERTIFICATE_REASON_CODES } from "@/features/certificates/reasons";

const requiredString = (message: string) => z.string().trim().min(1, message);

const certificateReasonSchema = z.enum(CERTIFICATE_REASON_CODES, {
  error: "Informe uma categoria de motivo valida.",
});

const issueCertificateSchema = z.object({
  courseId: requiredString("Informe o curso."),
  reasonCategory: certificateReasonSchema,
  reasonDetail: requiredString("Informe o detalhe interno do motivo."),
  userId: requiredString("Informe a aluna."),
});

const changeCertificateSchema = z.object({
  certificateId: requiredString("Informe o certificado."),
  reasonCategory: certificateReasonSchema,
  reasonDetail: requiredString("Informe o detalhe interno do motivo."),
});

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "");

export const parseIssueManualCertificateInput = (formData: FormData) =>
  issueCertificateSchema.parse({
    courseId: readString(formData, "courseId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
    userId: readString(formData, "userId"),
  });

export const parseChangeCertificateInput = (formData: FormData) =>
  changeCertificateSchema.parse({
    certificateId: readString(formData, "certificateId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
  });
