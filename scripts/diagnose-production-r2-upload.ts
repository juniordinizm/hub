import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { resolveProductionBackupR2Config } from "../src/tooling/production-backup-r2";

interface ProbeResult {
  cleanup: "completed" | "failed";
  errorCode?: string;
  errorName?: string;
  httpStatus?: number;
  mode: string;
  status: "completed" | "failed";
}

interface ProbeMode {
  body: "buffer" | "stream";
  conditional: boolean;
  maxAttempts?: number;
  name: string;
  sizeBytes: number;
}

const sanitizeErrorToken = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value) {
    return;
  }
  const token = value.replace(/[^A-Za-z0-9_-]/g, "");
  return token && token.length <= 64 ? token : "other";
};

const readErrorSummary = (
  error: unknown
): Pick<ProbeResult, "errorCode" | "errorName" | "httpStatus"> => {
  if (!(error instanceof Error)) {
    return {};
  }
  const record = error as Error & {
    $metadata?: { httpStatusCode?: unknown };
    Code?: unknown;
    code?: unknown;
  };
  const status = record.$metadata?.httpStatusCode;
  const errorCode = sanitizeErrorToken(record.Code ?? record.code);
  const errorName = sanitizeErrorToken(record.name);
  return {
    ...(errorCode ? { errorCode } : {}),
    ...(errorName ? { errorName } : {}),
    ...(typeof status === "number" && Number.isInteger(status)
      ? { httpStatus: status }
      : {}),
  };
};

const main = async (): Promise<void> => {
  const config = resolveProductionBackupR2Config(process.env);
  const directory = await mkdtemp(join(tmpdir(), "hub-production-r2-probe-"));
  const sizes = [1 * 1024, 1 * 1024 * 1024, 8 * 1024 * 1024, 32 * 1024 * 1024];
  const filePaths = new Map<number, string>();
  for (const sizeBytes of sizes) {
    const filePath = join(directory, `probe-${sizeBytes}.bin`);
    await writeFile(filePath, Buffer.alloc(sizeBytes, 0x5a), {
      mode: 0o600,
      flag: "wx",
    });
    filePaths.set(sizeBytes, filePath);
  }
  const results: ProbeResult[] = [];
  const modes: ProbeMode[] = [
    {
      body: "buffer",
      conditional: true,
      name: "buffer-1mb",
      sizeBytes: 1 * 1024 * 1024,
    },
    {
      body: "stream",
      conditional: true,
      name: "stream-1mb",
      sizeBytes: 1 * 1024 * 1024,
    },
    {
      body: "buffer",
      conditional: true,
      name: "buffer-8mb",
      sizeBytes: 8 * 1024 * 1024,
    },
    {
      body: "stream",
      conditional: true,
      name: "stream-8mb",
      sizeBytes: 8 * 1024 * 1024,
    },
    {
      body: "buffer",
      conditional: true,
      name: "buffer-32mb",
      sizeBytes: 32 * 1024 * 1024,
    },
    {
      body: "stream",
      conditional: true,
      name: "stream-32mb",
      sizeBytes: 32 * 1024 * 1024,
    },
    {
      body: "stream",
      conditional: true,
      maxAttempts: 3,
      name: "stream-32mb-retries",
      sizeBytes: 32 * 1024 * 1024,
    },
  ];

  try {
    for (const mode of modes) {
      const client = new S3Client({
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        endpoint: config.endpoint,
        ...(mode.maxAttempts ? { maxAttempts: mode.maxAttempts } : {}),
        region: config.region,
        requestStreamBufferSize: 64 * 1024,
      });
      const key = `diagnostics/r2-upload-probe-${randomUUID()}.bin`;
      try {
        const filePath = filePaths.get(mode.sizeBytes);
        if (!filePath) {
          throw new Error("diagnostic file is missing");
        }
        const input =
          mode.body === "stream"
            ? createReadStream(filePath)
            : await readFile(filePath);
        const command = new PutObjectCommand({
          ...(mode.conditional ? { IfNoneMatch: "*" } : {}),
          Body: input,
          Bucket: config.bucketName,
          ContentType: "application/octet-stream",
          ContentLength: mode.sizeBytes,
          Key: key,
          Metadata: {
            "backup-id": randomUUID(),
            sha256: "a".repeat(64),
          },
        });
        await client.send(command);
        let cleanup: ProbeResult["cleanup"] = "completed";
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: config.bucketName, Key: key })
          );
        } catch {
          cleanup = "failed";
        }
        results.push({ cleanup, mode: mode.name, status: "completed" });
      } catch (error: unknown) {
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: config.bucketName, Key: key })
          );
        } catch {
          // A failed PUT may not have created an object; cleanup is best effort.
        }
        results.push({
          cleanup: "failed",
          mode: mode.name,
          ...readErrorSummary(error),
          status: "failed",
        });
      } finally {
        client.destroy();
      }
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }

  process.stdout.write(`${JSON.stringify({ results })}\n`);
};

if (import.meta.main) {
  await main();
}
