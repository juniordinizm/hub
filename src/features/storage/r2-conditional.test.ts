import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    readonly input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  return {
    CopyObjectCommand: Command,
    DeleteObjectsCommand: Command,
    GetObjectCommand: Command,
    HeadObjectCommand: Command,
    PutObjectCommand: Command,
    S3Client: class {
      send = dependencies.send;
    },
  };
});

import { uploadPrivateR2ObjectIfAbsent } from "./r2";

describe("uploadPrivateR2ObjectIfAbsent", () => {
  beforeEach(() => {
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_ACCOUNT_ID", "account");
    vi.stubEnv("R2_BUCKET_NAME", "private");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates an immutable object with an If-None-Match precondition", async () => {
    dependencies.send.mockResolvedValue({});

    await expect(
      uploadPrivateR2ObjectIfAbsent({
        body: Buffer.from("pdf"),
        contentType: "application/pdf",
        key: "certificates/id/certificate.pdf",
      })
    ).resolves.toBe("created");

    expect(dependencies.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ IfNoneMatch: "*" }),
      })
    );
  });

  it("reports an existing object only for HTTP 412", async () => {
    dependencies.send.mockRejectedValue({
      $metadata: { httpStatusCode: 412 },
      name: "PreconditionFailed",
    });

    await expect(
      uploadPrivateR2ObjectIfAbsent({
        body: Buffer.from("pdf"),
        contentType: "application/pdf",
        key: "certificates/id/certificate.pdf",
      })
    ).resolves.toBe("existing");
  });

  it("propagates every failure other than HTTP 412", async () => {
    const error = Object.assign(new Error("r2_unavailable"), {
      $metadata: { httpStatusCode: 503 },
    });
    dependencies.send.mockRejectedValue(error);

    await expect(
      uploadPrivateR2ObjectIfAbsent({
        body: Buffer.from("pdf"),
        contentType: "application/pdf",
        key: "certificates/id/certificate.pdf",
      })
    ).rejects.toBe(error);
  });
});
