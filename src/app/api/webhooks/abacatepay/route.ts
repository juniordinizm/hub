import { NextResponse } from "next/server";
import {
  parseAbacatePayWebhookPayload,
  verifyAbacatePaySignature,
  verifyAbacatePayWebhookSecret,
} from "@/features/payments/abacatepay";
import { processAbacatePayWebhook } from "@/features/payments/server";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const POST = async (request: Request) => {
  const env = getServerEnv();

  if (!env.ABACATEPAY_WEBHOOK_ENABLED) {
    return new Response(null, { status: 204 });
  }

  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const rawBody = await request.text();
  const url = new URL(request.url);
  const receivedSecret =
    url.searchParams.get("webhookSecret") ??
    request.headers.get("x-webhook-secret");
  const signature =
    request.headers.get("x-webhook-signature") ??
    request.headers.get("abacatepay-signature");

  if (
    !verifyAbacatePayWebhookSecret({
      expectedSecret: env.ABACATEPAY_WEBHOOK_SECRET,
      isProduction: env.NODE_ENV === "production",
      receivedSecret,
    })
  ) {
    return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
  }

  if (
    !verifyAbacatePaySignature({
      legacySecret: env.ABACATEPAY_WEBHOOK_SECRET,
      payload: rawBody,
      signature,
    })
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = parseAbacatePayWebhookPayload(rawBody);

  if (!payload) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await observeOperation({
    correlationId,
    execute: () => processAbacatePayWebhook(payload),
    failureErrorCode: "webhook_processing_failed",
    operation: "webhook.abacatepay",
    provider: "abacatepay",
  });

  return NextResponse.json({ ok: true, ...result });
};
