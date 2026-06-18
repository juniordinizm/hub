import { describe, expect, it } from "vitest";
import {
  JMVSTREAM_UPLOAD_CHUNK_SIZE,
  S3_MIN_MULTIPART_PART_SIZE,
} from "./upload-config";

describe("JMVStream upload config", () => {
  it("keeps multipart chunks above the S3 minimum part size", () => {
    expect(JMVSTREAM_UPLOAD_CHUNK_SIZE).toBeGreaterThanOrEqual(
      S3_MIN_MULTIPART_PART_SIZE
    );
  });
});
