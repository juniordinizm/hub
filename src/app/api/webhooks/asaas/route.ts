import { NextResponse } from "next/server";
import {
  AsaasWebhookInputError,
  persistAsaasWebhook,
  verifyAsaasWebhookToken,
} from "@/features/payments/asaas-webhook-inbox";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAXIMUM_WEBHOOK_BODY_BYTES = 256 * 1024;

class WebhookBodyTooLargeError extends Error {}

const readBoundedBody = async (request: Request): Promise<string> => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAXIMUM_WEBHOOK_BODY_BYTES
  ) {
    throw new WebhookBodyTooLargeError();
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAXIMUM_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      throw new WebhookBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
};

export const POST = async (request: Request): Promise<Response> => {
  let expectedToken: string | undefined;
  try {
    const environment = getServerEnv();
    if (!environment.ASAAS_WEBHOOK_ENABLED) {
      return NextResponse.json(
        { error: "service_unavailable" },
        { status: 503 }
      );
    }
    expectedToken = environment.ASAAS_WEBHOOK_TOKEN;
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  if (!expectedToken || expectedToken.trim().length < 32) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
  if (
    !verifyAsaasWebhookToken({
      expectedToken,
      receivedToken: request.headers.get("asaas-access-token"),
    })
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readBoundedBody(request));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WebhookBodyTooLargeError
            ? "payload_too_large"
            : "invalid_payload",
      },
      { status: error instanceof WebhookBodyTooLargeError ? 413 : 400 }
    );
  }

  try {
    await persistAsaasWebhook({ payload });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AsaasWebhookInputError
            ? "invalid_payload"
            : "service_unavailable",
      },
      { status: error instanceof AsaasWebhookInputError ? 400 : 503 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
};
