import { JMVSTREAM_UPLOAD_CONCURRENCY } from "./upload-config";

const JMVSTREAM_UPLOAD_PART_ATTEMPTS = 3;

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
  chunkSize,
  fetcher = fetch,
  file,
  onProgress,
  presignedUrls,
  signal,
}: {
  chunkSize?: number | undefined;
  fetcher?: typeof fetch;
  file: File;
  onProgress: (value: number) => void;
  presignedUrls: JmvstreamPresignedUrl[];
  signal?: AbortSignal;
}): Promise<JmvstreamUploadPart[]> => {
  const urls = normalizePresignedUrls(presignedUrls);
  const resolvedChunkSize = chunkSize ?? Math.ceil(file.size / urls.length);
  const parts = new Array<JmvstreamUploadPart>(urls.length);
  const workerCount = Math.min(JMVSTREAM_UPLOAD_CONCURRENCY, urls.length);
  let nextIndex = 0;
  let completedParts = 0;

  const uploadNextPart = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;

    if (index >= urls.length) {
      return;
    }

    const item = urls[index];

    if (!item) {
      return;
    }
    const start = index * resolvedChunkSize;
    const end = Math.min(start + resolvedChunkSize, file.size);
    const chunk = file.slice(start, end);
    const etag = await uploadPart({
      chunk,
      fetcher,
      ...(signal ? { signal } : {}),
      url: item.url,
    });

    parts[index] = {
      ETag: etag,
      PartNumber: item.partNumber,
    };
    completedParts += 1;
    onProgress(Math.round((completedParts / urls.length) * 90));
    await uploadNextPart();
  };

  await Promise.all(
    Array.from({ length: workerCount }, () => uploadNextPart())
  );

  return parts.sort((left, right) => left.PartNumber - right.PartNumber);
};

const uploadPart = async ({
  chunk,
  fetcher,
  signal,
  url,
}: {
  chunk: Blob;
  fetcher: typeof fetch;
  signal?: AbortSignal;
  url: string;
}): Promise<string> => {
  for (
    let attempt = 1;
    attempt <= JMVSTREAM_UPLOAD_PART_ATTEMPTS;
    attempt += 1
  ) {
    let response: Response;

    try {
      response = await fetcher(url, {
        body: chunk,
        method: "PUT",
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (isBrowserNetworkBlock(error)) {
        throw new Error(
          "O navegador bloqueou o upload direto para a JMVStream/S3. Configure CORS/Expose-Headers: ETag na JMV/S3."
        );
      }

      throw error;
    }

    if (!response.ok) {
      if (response.status >= 500 && attempt < JMVSTREAM_UPLOAD_PART_ATTEMPTS) {
        continue;
      }

      throw new Error("A JMVStream recusou uma parte do upload.");
    }

    const etag = response.headers.get("ETag");

    if (!etag) {
      throw new Error(
        "A JMVStream nao retornou o ETag do upload. Configure CORS/Expose-Headers: ETag na JMV/S3."
      );
    }

    return etag;
  }

  throw new Error("A JMVStream recusou uma parte do upload.");
};

const isBrowserNetworkBlock = (error: unknown): boolean =>
  error instanceof TypeError && error.message === "Failed to fetch";
