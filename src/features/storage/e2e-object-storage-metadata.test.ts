import { describe, expect, it } from "vitest";
import { getE2eObjectStorageMetadataHeaders } from "./e2e-object-storage-metadata";

describe("E2E object-storage metadata", () => {
  it("round-trips normalized S3 metadata with one string value", () => {
    const storedMetadata = getE2eObjectStorageMetadataHeaders({
      "Content-Type": "application/pdf",
      "X-Amz-Meta-Origin": "certificate-worker",
      "X-Amz-Meta-SHA256": ["expected-hash", "duplicate-hash"],
      "x-amz-meta-missing": undefined,
    });

    expect(getE2eObjectStorageMetadataHeaders(storedMetadata)).toEqual({
      "x-amz-meta-origin": "certificate-worker",
      "x-amz-meta-sha256": "expected-hash",
    });
  });
});
