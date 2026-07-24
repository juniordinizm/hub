type E2eR2Environment = Readonly<Record<string, string | undefined>>;

export const requireIsolatedE2eR2Bucket = (
  environment: E2eR2Environment
): string => {
  const bucketName = environment.R2_BUCKET_NAME;
  if (!bucketName?.trim()) {
    throw new Error("R2_BUCKET_NAME is required for E2E R2 operations.");
  }

  const confirmedE2eBucketName = environment.E2E_R2_BUCKET_NAME;
  if (!confirmedE2eBucketName?.trim()) {
    throw new Error(
      "E2E_R2_BUCKET_NAME is required to confirm the isolated E2E bucket."
    );
  }

  if (confirmedE2eBucketName !== bucketName) {
    throw new Error(
      "E2E_R2_BUCKET_NAME must exactly match R2_BUCKET_NAME for E2E R2 operations."
    );
  }

  return bucketName;
};
