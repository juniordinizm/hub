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
}: {
  fetcher?: typeof fetch;
  file: File;
  onProgress: (value: number) => void;
  presignedUrls: JmvstreamPresignedUrl[];
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
  url,
}: {
  chunk: Blob;
  contentType: string;
  fetcher: typeof fetch;
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
      throw new Error(
        "A JMVStream nao retornou o ETag do upload. Configure CORS/Expose-Headers: ETag na JMV/S3 ou use um backend dedicado de upload."
      );
    }

    return etag;
  } catch (error) {
    if (isBrowserNetworkBlock(error)) {
      throw new Error(
        "O navegador bloqueou o upload direto para a JMVStream/S3. Configure CORS/Expose-Headers: ETag na JMV/S3 ou use um backend dedicado de upload."
      );
    }

    throw error;
  }
};

const isBrowserNetworkBlock = (error: unknown): boolean =>
  error instanceof TypeError && error.message === "Failed to fetch";
