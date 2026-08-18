const S3_METADATA_HEADER_PREFIX = "x-amz-meta-";

type E2eObjectStorageRequestHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export const getE2eObjectStorageMetadataHeaders = (
  headers: E2eObjectStorageRequestHeaders
): Record<string, string> => {
  const metadataHeaders: Record<string, string> = {};

  for (const [headerName, headerValue] of Object.entries(headers)) {
    const normalizedName = headerName.toLowerCase();
    if (!normalizedName.startsWith(S3_METADATA_HEADER_PREFIX)) {
      continue;
    }

    const stringValue = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    if (stringValue !== undefined) {
      metadataHeaders[normalizedName] = stringValue;
    }
  }

  return metadataHeaders;
};
