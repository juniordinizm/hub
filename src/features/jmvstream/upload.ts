export interface JmvstreamUploadPart {
  ETag: string;
  PartNumber: number;
}

export type JmvstreamPresignedUrl =
  | string
  | { partNumber?: number; url: string };

export const normalizePresignedUrls = (
  presignedUrls: JmvstreamPresignedUrl[]
): Array<{ partNumber: number; url: string }> =>
  presignedUrls.map((item, index) => {
    if (typeof item === "string") {
      return { partNumber: index + 1, url: item };
    }

    return {
      partNumber: item.partNumber ?? index + 1,
      url: item.url,
    };
  });

export const uploadFileParts = async ({
  fetcher = fetch,
  file,
  onProgress,
  presignedUrls,
  uploadPartProxyUrl = null,
}: {
  fetcher?: typeof fetch;
  file: File;
  onProgress: (value: number) => void;
  presignedUrls: JmvstreamPresignedUrl[];
  uploadPartProxyUrl?: null | string;
}): Promise<JmvstreamUploadPart[]> => {
  const urls = normalizePresignedUrls(presignedUrls);
  const chunkSize = Math.ceil(file.size / urls.length);
  const parts: JmvstreamUploadPart[] = [];
  const contentType = file.type || "application/octet-stream";

  for (const [index, item] of urls.entries()) {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const etag = await uploadPart({
      chunk,
      contentType,
      fetcher,
      uploadPartProxyUrl,
      url: item.url,
    });

    parts.push({
      ETag: etag,
      PartNumber: item.partNumber,
    });
    onProgress(Math.round(((index + 1) / urls.length) * 90));
  }

  return parts.sort((left, right) => left.PartNumber - right.PartNumber);
};

const uploadPart = async ({
  chunk,
  contentType,
  fetcher,
  uploadPartProxyUrl,
  url,
}: {
  chunk: Blob;
  contentType: string;
  fetcher: typeof fetch;
  uploadPartProxyUrl: null | string;
  url: string;
}): Promise<string> => {
  try {
    const response = await fetcher(url, {
      body: chunk,
      headers: { "Content-Type": contentType },
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error("A JMVStream recusou uma parte do upload.");
    }

    const etag = response.headers.get("ETag");

    if (!etag) {
      if (uploadPartProxyUrl) {
        return uploadPartViaDedicatedProxy({
          chunk,
          contentType,
          fetcher,
          uploadPartProxyUrl,
          url,
        });
      }

      throw new Error(
        "A JMVStream nao retornou o ETag do upload. Configure CORS/Expose-Headers: ETag na JMV/S3 ou use um backend dedicado de upload."
      );
    }

    return etag;
  } catch (error) {
    if (isBrowserNetworkBlock(error)) {
      if (uploadPartProxyUrl) {
        return uploadPartViaDedicatedProxy({
          chunk,
          contentType,
          fetcher,
          uploadPartProxyUrl,
          url,
        });
      }

      throw new Error(
        "O navegador bloqueou o upload direto para a JMVStream/S3. Configure CORS/Expose-Headers: ETag na JMV/S3 ou use um backend dedicado de upload."
      );
    }

    throw error;
  }
};

const isBrowserNetworkBlock = (error: unknown): boolean =>
  error instanceof TypeError && error.message === "Failed to fetch";

const uploadPartViaDedicatedProxy = async ({
  chunk,
  contentType,
  fetcher,
  uploadPartProxyUrl,
  url,
}: {
  chunk: Blob;
  contentType: string;
  fetcher: typeof fetch;
  uploadPartProxyUrl: string;
  url: string;
}): Promise<string> => {
  const proxyUrl = createProxyPartUrl(uploadPartProxyUrl, url);
  const response = await fetcher(proxyUrl, {
    body: chunk,
    headers: { "Content-Type": contentType },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      "O backend dedicado nao conseguiu enviar a parte para a JMVStream/S3."
    );
  }

  const etag = response.headers.get("ETag");

  if (!etag) {
    throw new Error(
      "O backend dedicado enviou a parte, mas nao retornou o ETag da JMVStream/S3."
    );
  }

  return etag;
};

const createProxyPartUrl = (
  uploadPartProxyUrl: string,
  presignedUrl: string
): string => {
  const separator = uploadPartProxyUrl.includes("?") ? "&" : "?";
  return `${uploadPartProxyUrl}${separator}url=${encodeURIComponent(
    presignedUrl
  )}`;
};
