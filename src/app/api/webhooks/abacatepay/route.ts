import { NextResponse } from "next/server";
import {
  processAbacatePayWebhook,
  verifyAbacatePaySignature,
} from "@/features/payments/server";
import { getServerEnv } from "@/lib/env";

export const POST = async (request: Request) => {
  const rawBody = await request.text();
  const env = getServerEnv();
  const signature = request.headers.get("abacatepay-signature");

  if (
    !verifyAbacatePaySignature({
      payload: rawBody,
      signature,
      secret: env.ABACATEPAY_WEBHOOK_SECRET,
    })
  ) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const result = await processAbacatePayWebhook(payload);

  return NextResponse.json({ ok: true, ...result });
};
