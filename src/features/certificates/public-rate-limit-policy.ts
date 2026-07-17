const MAX_REQUESTS_PER_WINDOW = 20;

export const getPublicCertificateRateLimitDecision = ({
  requestCount,
}: {
  requestCount: number;
}): "allowed" | "limited" =>
  requestCount > MAX_REQUESTS_PER_WINDOW ? "limited" : "allowed";
