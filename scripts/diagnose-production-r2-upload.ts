import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
  const filePath = join(directory, "probe.bin");
  const content = Buffer.from("r2-upload-probe-no-sensitive-data\n", "utf8");
  await writeFile(filePath, content, { mode: 0o600, flag: "wx" });
  const results: ProbeResult[] = [];
  const modes = [
    {
      contentLength: true,
      conditional: true,
      name: "buffer-conditional",
      stream: false,
    },
    {
      contentLength: true,
      conditional: true,
      name: "stream-conditional",
      stream: true,
    },
    {
      contentLength: true,
      conditional: false,
      name: "buffer-basic",
      stream: false,
    },
    {
      contentLength: true,
      conditional: false,
      name: "stream-basic",
      stream: true,
    },
    {
      contentLength: false,
      conditional: false,
      name: "stream-no-length",
      stream: true,
    },
  ] as const;

  try {
    for (const mode of modes) {
      const client = new S3Client({
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        endpoint: config.endpoint,
        maxAttempts: 1,
        region: config.region,
        requestStreamBufferSize: 64 * 1024,
      });
      const key = `diagnostics/r2-upload-probe-${randomUUID()}.bin`;
      try {
        const input = mode.stream ? createReadStream(filePath) : content;
        const command = new PutObjectCommand({
          ...(mode.conditional ? { IfNoneMatch: "*" } : {}),
          ...(mode.contentLength ? { ContentLength: content.length } : {}),
          Body: input,
          Bucket: config.bucketName,
          ContentType: "application/octet-stream",
          Key: key,
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
