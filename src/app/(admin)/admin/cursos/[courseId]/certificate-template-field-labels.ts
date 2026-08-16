import type { CertificateTemplateField } from "@/features/certificates/template-rules";

export const certificateTemplateFieldLabels: Record<
  CertificateTemplateField["field"],
  string
> = {
  completedAt: "Data de conclusão",
  courseTitle: "Título do curso",
  issuedAt: "Data de emissão",
  issuerCnpj: "CNPJ do emissor",
  issuerName: "Nome do emissor",
  qrCode: "QR de validação",
  signatureImage: "Assinatura visual",
  signerName: "Nome do signatário",
  signerRole: "Cargo do signatário",
  studentName: "Nome no certificado",
  validationCode: "Código de validação",
  workloadHours: "Carga horária",
};
