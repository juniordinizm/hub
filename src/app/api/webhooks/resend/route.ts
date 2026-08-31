import type { PoolClient } from "pg";
import { Resend } from "resend";
import { getPool } from "@/db";
import {
  normalizeResendWebhookEvent,
  persistResendWebhookEvent,
} from "@/features/email-delivery/resend-webhook";
import { runResendWebhookJob } from "@/features/email-delivery/resend-webhook-job";
import { scheduleAfterResponse } from "@/features/operations/background-drain";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_WEBHOOK_BODY_BYTES = 256 * 1024;

type LimitedBodyResult =
  | { kind: "ok"; body: string }
  | { kind: "too_large" }
  | { kind: "invalid" };

const readLimitedBody = async (
  request: Request
): Promise<LimitedBodyResult> => {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedContentLength = Number(contentLength);
    if (
      Number.isSafeInteger(parsedContentLength) &&
      parsedContentLength > MAXIMUM_WEBHOOK_BODY_BYTES
    ) {
      return { kind: "too_large" };
    }
  }

  if (!request.body) {
    return { body: "", kind: "ok" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    const reader = request.body.getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      const chunk = result.value;
      if (!chunk) {
        return { kind: "invalid" };
      }
      totalBytes += chunk.byteLength;
      if (totalBytes > MAXIMUM_WEBHOOK_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the payload-size response when the client closes early.
        }
        return { kind: "too_large" };
      }
      chunks.push(chunk);
    }
  } catch {
    return { kind: "invalid" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), kind: "ok" };
};

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!(svixId && svixTimestamp && svixSignature)) {
    return jsonError("invalid_signature", 400);
  }

  let apiKey: string | undefined;
  let webhookSecret: string | undefined;
  try {
    const environment = getServerEnv();
    apiKey = environment.RESEND_API_KEY;
    webhookSecret = environment.RESEND_WEBHOOK_SECRET;
  } catch {
    return jsonError("service_unavailable", 503);
  }
  if (!(apiKey && webhookSecret && webhookSecret.length >= 32)) {
    return jsonError("service_unavailable", 503);
  }

  const bodyResult = await readLimitedBody(request);
  if (bodyResult.kind === "too_large") {
    return jsonError("payload_too_large", 413);
  }
  if (bodyResult.kind === "invalid") {
    return jsonError("invalid_payload", 400);
  }
  const rawBody = bodyResult.body;

  let verifiedEvent: unknown;
  try {
    verifiedEvent = new Resend(apiKey).webhooks.verify({
      headers: {
        id: svixId,
        signature: svixSignature,
        timestamp: svixTimestamp,
      },
      payload: rawBody,
      webhookSecret,
    });
  } catch {
    return jsonError("invalid_signature", 400);
  }

  const event = normalizeResendWebhookEvent({
    providerEventId: svixId,
    rawBody,
    verifiedEvent,
  });
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch {
    return jsonError("service_unavailable", 503);
  }
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    await persistResendWebhookEvent({ client, event });
    await client.query("commit");
    transactionOpen = false;
    scheduleAfterResponse(() =>
      observeOperation({
        correlationId,
        execute: () =>
          runResendWebhookJob({
            deadlineMs: 45_000,
            limit: 1,
          }).then(() => undefined),
        failureErrorCode: "resend_webhook_background_failed",
        operation: "webhook.resend.drain",
        provider: "resend",
      }).catch(() => undefined)
    );
    return Response.json({ ok: true }, { status: 200 });
  } catch {
    if (transactionOpen) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the sanitized service failure response.
      }
    }
    return jsonError("service_unavailable", 503);
  } finally {
    client.release();
  }
};
