const CERTIFICATE_PREFIX = "PRT";
const CODE_LENGTH = 8;
export const CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES = 10;

export const canIssueCertificate = ({
  totalLessons,
  completedLessons,
}: {
  totalLessons: number;
  completedLessons: number;
}): boolean => totalLessons > 0 && completedLessons >= totalLessons;

export const createCertificateCode = (seed: string): string => {
  const normalizedSeed = seed.replaceAll(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `${CERTIFICATE_PREFIX}-${normalizedSeed.slice(0, CODE_LENGTH)}`;
};

export const getCertificateValidationPath = (code: string): string =>
  `/certificados/${encodeURIComponent(code)}`;
