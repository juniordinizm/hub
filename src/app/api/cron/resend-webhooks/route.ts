import { NextResponse } from "next/server";
import { runResendWebhookJob } from "@/features/email-delivery/resend-webhook-job";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export const GET = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const earlyResponse = getScheduledJobEarlyResponse(request);
  if (earlyResponse) {
    return earlyResponse;
  }
  const result = await observeOperation({
    correlationId,
    execute: () => runResendWebhookJob(),
    failureErrorCode: "resend_webhook_worker_failed",
    operation: "cron.resend_webhooks",
    provider: "resend",
  });
  return NextResponse.json({ ok: true, ...result });
};
