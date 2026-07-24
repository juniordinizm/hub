const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export interface R2ClientEndpoint {
  endpoint: string;
  forcePathStyle: boolean;
}

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
