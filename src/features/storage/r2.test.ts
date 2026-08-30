import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  commands: [] as Array<{ input: Record<string, unknown> }>,
  getServerEnv: vi.fn(),
  signed: [] as Array<{
    command: { input: Record<string, unknown> };
    options: Record<string, unknown>;
  }>,
}));
const EXPIRES_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const RESOURCE_KEY_PATTERN =
  /^lessons\/lesson-1\/resources\/[0-9a-f-]+-material\.pdf$/i;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: state.getServerEnv }));
vi.mock("@aws-sdk/client-s3", () => ({
  CopyObjectCommand: class {},
  DeleteObjectsCommand: class {},
  GetObjectCommand: class {},
  HeadObjectCommand: class {},
  ListObjectsV2Command: class {},
  PutObjectCommand: class {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
      state.commands.push(this);
    }
  },
  S3Client: class {},
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn((_client, command, options) => {
    state.signed.push({ command, options });
    return Promise.resolve(`https://r2.example.test/${state.signed.length}`);
  }),
}));

import {
  createLessonResourceUploadUrl,
  createLessonResourceUploadUrlForReference,
} from "./r2";

const env = {
  E2E_TEST_MODE: false,
  R2_ACCESS_KEY_ID: "access-key",
  R2_ACCOUNT_ID: "account-1",
  R2_BUCKET_NAME: "neuro-prod-private",
  R2_OBJECT_PREFIX: undefined,
  R2_SECRET_ACCESS_KEY: "secret-key",
};

describe("R2 lesson resource signing", () => {
  beforeEach(() => {
    state.commands.length = 0;
    state.signed.length = 0;
    state.getServerEnv.mockReturnValue(env);
  });

  it("signs the exact bucket, key, content type and ten-minute expiry", async () => {
    const prepared = await createLessonResourceUploadUrl({
      contentType: "application/pdf",
      fileName: "material.pdf",
      lessonId: "lesson-1",
      sizeBytes: 1024,
    });

    expect(prepared.expiresAt).toMatch(EXPIRES_AT_PATTERN);
    expect(prepared.reference.key).toMatch(RESOURCE_KEY_PATTERN);
    expect(state.signed[0]?.command.input).toMatchObject({
      Bucket: "neuro-prod-private",
      ContentType: "application/pdf",
      Key: prepared.reference.key,
    });
    expect(state.signed[0]?.options).toMatchObject({
      expiresIn: 10 * 60,
      signableHeaders: new Set(["content-type"]),
    });
  });

  it("reissues a signed URL without changing the prepared object key", async () => {
    const reference = {
      contentType: "application/pdf",
      fileName: "material.pdf",
      id: "resource-1",
      key: "lessons/lesson-1/resources/resource-1-material.pdf",
      label: "material.pdf",
      sizeBytes: 1024,
      storage: "r2" as const,
    };

    const prepared = await createLessonResourceUploadUrlForReference({
      reference,
    });

    expect(prepared.reference).toEqual(reference);
    expect(state.signed[0]?.command.input).toMatchObject({
      Bucket: "neuro-prod-private",
      ContentType: "application/pdf",
      Key: reference.key,
    });
  });
});
