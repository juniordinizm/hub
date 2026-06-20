import { NextResponse } from "next/server";
import {
  parseAbacatePayWebhookPayload,
  verifyAbacatePaySignature,
  verifyAbacatePayWebhookSecret,
} from "@/features/payments/abacatepay";
import { processAbacatePayWebhook } from "@/features/payments/server";
import { getServerEnv } from "@/lib/env";

export const POST = async (request: Request) => {
  const rawBody = await request.text();
  const env = getServerEnv();
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

  const result = await processAbacatePayWebhook(payload);

  return NextResponse.json({ ok: true, ...result });
};
