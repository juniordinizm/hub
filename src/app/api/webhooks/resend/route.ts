import type { PoolClient } from "pg";
import { Resend } from "resend";
import { getPool } from "@/db";
import {
  normalizeResendWebhookEvent,
  persistResendWebhookEvent,
} from "@/features/email-delivery/resend-webhook";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_WEBHOOK_BODY_BYTES = 256 * 1024;

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export const POST = async (request: Request): Promise<Response> => {
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

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError("invalid_payload", 400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAXIMUM_WEBHOOK_BODY_BYTES) {
    return jsonError("payload_too_large", 413);
  }

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
