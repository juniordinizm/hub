export const CERTIFICATE_REASON_CODES = [
  "identity_correction",
  "course_snapshot_correction",
  "eligibility_correction",
  "duplicate_or_technical_issue",
  "integrity_review",
  "legal_or_compliance",
  "other",
] as const;

export type CertificateReasonCode = (typeof CERTIFICATE_REASON_CODES)[number];

const CERTIFICATE_REASON_LABELS: Record<CertificateReasonCode, string> = {
  course_snapshot_correction: "Correcao de informacoes do curso",
  duplicate_or_technical_issue: "Duplicidade ou falha tecnica",
  eligibility_correction: "Correcao de elegibilidade",
  identity_correction: "Correcao de identidade",
  integrity_review: "Revisao de integridade",
  legal_or_compliance: "Obrigacao legal ou de conformidade",
  other: "Outro motivo administrativo",
};

export const parseCertificateReasonCode = (
  value: string | null | undefined
): CertificateReasonCode | null =>
  CERTIFICATE_REASON_CODES.includes(value as CertificateReasonCode)
    ? (value as CertificateReasonCode)
    : null;

export const certificateReasonLabel = (reason: CertificateReasonCode): string =>
  CERTIFICATE_REASON_LABELS[reason];
