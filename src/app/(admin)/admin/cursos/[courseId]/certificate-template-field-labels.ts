import type { CertificateTemplateField } from "@/features/certificates/template-rules";

export const certificateTemplateFieldLabels: Record<
  CertificateTemplateField["field"],
  string
> = {
  completedAt: "Conclusão",
  courseFreeStatement: "Texto de curso livre",
  courseTitle: "Curso",
  issuedAt: "Emissão",
  issuerCnpj: "CNPJ",
  issuerName: "Empresa",
  qrCode: "QR de validação",
  signatureImage: "Posição da assinatura",
  signerName: "Assinatura",
  signerRole: "Cargo — posição",
  studentName: "Nome da aluna",
  validationCode: "Código",
  workloadHours: "Carga horária",
};
