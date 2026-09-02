const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const R2_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const R2_BUCKET_NAME_PATTERN = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export interface R2ClientEndpoint {
  endpoint: string;
  forcePathStyle: boolean;
}

export const resolveR2BucketOrigin = ({
  accountId,
  bucketName,
}: {
  accountId?: string | undefined;
  bucketName?: string | undefined;
}): string | null => {
  const normalizedAccountId = accountId?.trim();
  const normalizedBucketName = bucketName?.trim();

  if (
    !(
      normalizedAccountId &&
      normalizedBucketName &&
      R2_ACCOUNT_ID_PATTERN.test(normalizedAccountId) &&
      R2_BUCKET_NAME_PATTERN.test(normalizedBucketName)
    )
  ) {
    return null;
  }

  return `https://${normalizedBucketName}.${normalizedAccountId}.r2.cloudflarestorage.com`;
};

export const resolveR2ClientEndpoint = ({
  accountId,
  e2eTestMode,
  endpointOverride,
}: {
  accountId: string;
  e2eTestMode: boolean;
  endpointOverride?: string;
}): R2ClientEndpoint => {
  const normalizedOverride = endpointOverride?.trim();
  if (!normalizedOverride) {
    return {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: false,
    };
  }
  if (!e2eTestMode) {
    throw new Error("R2_ENDPOINT exige E2E_TEST_MODE=true.");
  }

  const endpointUrl = new URL(normalizedOverride);
  if (
    endpointUrl.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(endpointUrl.hostname)
  ) {
    throw new Error("R2_ENDPOINT de E2E deve usar HTTP em loopback.");
  }

  const endpoint = endpointUrl.toString();
  return {
    endpoint: endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint,
    forcePathStyle: true,
  };
};
