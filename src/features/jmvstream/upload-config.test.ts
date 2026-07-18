import { describe, expect, it } from "vitest";
import {
  getJmvstreamMultipartUploadConfig,
  JMVSTREAM_UPLOAD_CHUNK_SIZE,
  JMVSTREAM_UPLOAD_CONCURRENCY,
  S3_MIN_MULTIPART_PART_SIZE,
} from "./upload-config";

describe("JMVStream upload config", () => {
  it("keeps multipart chunks above the S3 minimum part size", () => {
    expect(JMVSTREAM_UPLOAD_CHUNK_SIZE).toBeGreaterThanOrEqual(
      S3_MIN_MULTIPART_PART_SIZE
    );
  });

  it("uses larger chunks and bounded browser concurrency for large videos", () => {
    expect(JMVSTREAM_UPLOAD_CHUNK_SIZE).toBeGreaterThanOrEqual(
      32 * 1024 * 1024
    );
    expect(JMVSTREAM_UPLOAD_CONCURRENCY).toBeGreaterThanOrEqual(3);
    expect(JMVSTREAM_UPLOAD_CONCURRENCY).toBeLessThanOrEqual(6);
  });

  it("keeps huge uploads within the provider's ten-thousand-part limit", () => {
    const config = getJmvstreamMultipartUploadConfig(5 * 1024 ** 4);

    expect(config.chunkSize * 10_000).toBeGreaterThanOrEqual(5 * 1024 ** 4);
    expect(config.totalParts).toBeLessThanOrEqual(10_000);
  });

  it("rejects empty files before requesting signed upload URLs", () => {
    expect(() => getJmvstreamMultipartUploadConfig(0)).toThrow(
      "maior que zero"
    );
  });
});
