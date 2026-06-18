const JMVSTREAM_S3_HOSTNAME = "s3.jmvstream.com";

export const assertJmvstreamPresignedUploadUrl = (url: string): void => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("URL assinada JMVStream invalida.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== JMVSTREAM_S3_HOSTNAME
  ) {
    throw new Error("URL assinada JMVStream invalida.");
  }
};

export const proxyJmvstreamUploadPart = async ({
  body,
  contentType,
  fetcher = fetch,
  url,
}: {
  body: BodyInit;
  contentType: string;
  fetcher?: typeof fetch;
  url: string;
}): Promise<string> => {
  assertJmvstreamPresignedUploadUrl(url);

  const response = await fetcher(url, {
    body,
    headers: { "Content-Type": contentType },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("A JMVStream recusou uma parte do upload via proxy.");
  }

  const etag = response.headers.get("ETag");

  if (!etag) {
    throw new Error("A JMVStream nao retornou o ETag do upload via proxy.");
  }

  return etag;
};
