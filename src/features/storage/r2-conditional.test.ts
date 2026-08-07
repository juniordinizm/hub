import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
  send: vi.fn(),
}));
const LOGICAL_LESSON_KEY = /^lessons\/lesson-1\//;
const PHYSICAL_LESSON_KEY = /^staging\/lessons\/lesson-1\//;

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
    ListObjectsV2Command: Command,
    PutObjectCommand: Command,
    S3Client: class {
      send = dependencies.send;
    },
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: dependencies.getSignedUrl,
}));

import {
  confirmLessonResourceUpload,
  createLessonResourceUploadUrl,
  deleteExpiredStagedAdminImages,
  publishR2Object,
  uploadPrivateR2ObjectIfAbsent,
  verifyPrivateR2ObjectSha256,
} from "./r2";

describe("uploadPrivateR2ObjectIfAbsent", () => {
  beforeEach(() => {
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_ACCOUNT_ID", "account");
    vi.stubEnv("R2_BUCKET_NAME", "private");
    vi.stubEnv("R2_PUBLIC_BUCKET_NAME", "public");
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

  it("persists certificate hash metadata with a conditional artifact write", async () => {
    dependencies.send.mockResolvedValue({});

    await uploadPrivateR2ObjectIfAbsent({
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
      key: "certificates/id/certificate.pdf",
      metadata: { sha256: "a".repeat(64) },
    });

    expect(dependencies.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Metadata: { sha256: "a".repeat(64) },
        }),
      })
    );
  });

  it.each([
    ["match", "A".repeat(64), "match"],
    ["mismatch", "b".repeat(64), "mismatch"],
  ] as const)("reports a %s certificate artifact hash", async (_label, actualHash, expected) => {
    dependencies.send.mockResolvedValue({
      Metadata: { sha256: actualHash },
    });

    await expect(
      verifyPrivateR2ObjectSha256({
        expectedSha256: "a".repeat(64),
        key: "certificates/id/certificate.pdf",
      })
    ).resolves.toBe(expected);
  });

  it("keeps legacy artifacts explicitly unverifiable until metadata is backfilled", async () => {
    dependencies.send.mockResolvedValue({ Metadata: {} });

    await expect(
      verifyPrivateR2ObjectSha256({
        expectedSha256: "a".repeat(64),
        key: "certificates/legacy/certificate.pdf",
      })
    ).resolves.toBe("unknown");
  });

  it.each([
    ["missing", { $metadata: { httpStatusCode: 404 } }],
    ["unavailable", { $metadata: { httpStatusCode: 503 } }],
  ] as const)("reports an R2 %s while checking a certificate artifact", async (expected, error) => {
    dependencies.send.mockRejectedValue(error);

    await expect(
      verifyPrivateR2ObjectSha256({
        expectedSha256: "a".repeat(64),
        key: "certificates/id/certificate.pdf",
      })
    ).resolves.toBe(expected);
  });

  it("prefixes a conditional certificate write in Staging", async () => {
    vi.stubEnv("R2_OBJECT_PREFIX", "staging");
    dependencies.send.mockResolvedValue({});

    await uploadPrivateR2ObjectIfAbsent({
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
      key: "certificates/id/certificate.pdf",
    });

    expect(dependencies.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Key: "staging/certificates/id/certificate.pdf",
        }),
      })
    );
  });

  it("keeps lesson references logical while signing a physical Staging key", async () => {
    vi.stubEnv("R2_OBJECT_PREFIX", "staging");
    dependencies.getSignedUrl.mockImplementation(
      async (_client, command) => command.input.Key
    );

    const result = await createLessonResourceUploadUrl({
      contentType: "application/pdf",
      fileName: "material.pdf",
      lessonId: "lesson-1",
      sizeBytes: 100,
    });

    expect(result.resource.key).toMatch(LOGICAL_LESSON_KEY);
    expect(result.uploadUrl).toMatch(PHYSICAL_LESSON_KEY);
  });

  it("uses physical Staging keys for lesson checks and publication", async () => {
    vi.stubEnv("R2_OBJECT_PREFIX", "staging");
    dependencies.send.mockResolvedValue({
      ContentLength: 100,
      ContentType: "application/pdf",
    });

    await confirmLessonResourceUpload({
      contentType: "application/pdf",
      key: "lessons/lesson-1/material.pdf",
      sizeBytes: 100,
    });
    await publishR2Object("courses/course-1/cover.webp");

    expect(dependencies.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          Key: "staging/lessons/lesson-1/material.pdf",
        }),
      })
    );
    expect(dependencies.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          CopySource: "/private/staging%2Fcourses%2Fcourse-1%2Fcover.webp",
          Key: "staging/courses/course-1/cover.webp",
        }),
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

  it("removes only expired staged admin images", async () => {
    dependencies.send
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: "uploads/admin-images/admin-1/course-cover/expired.png",
            LastModified: new Date("2026-07-20T00:00:00.000Z"),
          },
          {
            Key: "uploads/admin-images/admin-1/course-cover/current.png",
            LastModified: new Date("2026-07-25T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({});

    await expect(
      deleteExpiredStagedAdminImages({
        olderThan: new Date("2026-07-24T00:00:00.000Z"),
      })
    ).resolves.toBe(1);

    expect(dependencies.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          Prefix: "uploads/admin-images/",
        }),
      })
    );
    expect(dependencies.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          Delete: {
            Objects: [
              {
                Key: "uploads/admin-images/admin-1/course-cover/expired.png",
              },
            ],
            Quiet: true,
          },
        }),
      })
    );
  });

  it("lists and deletes only inside the physical Staging namespace", async () => {
    vi.stubEnv("R2_OBJECT_PREFIX", "staging");
    dependencies.send
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: "staging/uploads/admin-images/admin-1/expired.png",
            LastModified: new Date("2026-07-20T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({});

    await deleteExpiredStagedAdminImages({
      olderThan: new Date("2026-07-24T00:00:00.000Z"),
    });

    expect(dependencies.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          Prefix: "staging/uploads/admin-images/",
        }),
      })
    );
    expect(dependencies.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          Delete: {
            Objects: [
              {
                Key: "staging/uploads/admin-images/admin-1/expired.png",
              },
            ],
            Quiet: true,
          },
        }),
      })
    );
  });
});
