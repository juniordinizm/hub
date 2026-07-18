export const S3_MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024;
export const JMVSTREAM_UPLOAD_CHUNK_SIZE = 64 * 1024 * 1024;
export const JMVSTREAM_UPLOAD_CONCURRENCY = 4;
export const JMVSTREAM_MAX_MULTIPART_PARTS = 10_000;
export const JMVSTREAM_MAX_UPLOAD_SIZE = 5 * 1024 ** 4;

const MEDIUM_UPLOAD_MAX_SIZE = 1024 ** 3;
const MEDIUM_UPLOAD_CHUNK_SIZE = 16 * 1024 * 1024;
const MEBIBYTE = 1024 * 1024;

export const getJmvstreamMultipartUploadConfig = (
  fileSize: number
): { chunkSize: number; totalParts: number } => {
  if (!(Number.isFinite(fileSize) && fileSize > 0)) {
    throw new Error("O arquivo de video deve ter tamanho maior que zero.");
  }

  if (fileSize > JMVSTREAM_MAX_UPLOAD_SIZE) {
    throw new Error("O arquivo de video excede o limite de 5 TB da JMVStream.");
  }

  const baseChunkSize =
    fileSize <= MEDIUM_UPLOAD_MAX_SIZE
      ? MEDIUM_UPLOAD_CHUNK_SIZE
      : JMVSTREAM_UPLOAD_CHUNK_SIZE;
  const minimumChunkSize = Math.ceil(fileSize / JMVSTREAM_MAX_MULTIPART_PARTS);
  const chunkSize = Math.max(
    S3_MIN_MULTIPART_PART_SIZE,
    baseChunkSize,
    Math.ceil(minimumChunkSize / MEBIBYTE) * MEBIBYTE
  );

  return {
    chunkSize,
    totalParts: Math.ceil(fileSize / chunkSize),
  };
};
