import { describe, expect, it } from "vitest";
import {
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
});
