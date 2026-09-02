import { NextResponse } from "next/server";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import { runOutboxJob } from "@/features/outbox/outbox-job";
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
    execute: () => runOutboxJob(),
    failureErrorCode: "outbox_worker_failed",
    operation: "cron.outbox",
  });

  return NextResponse.json({ ok: true, ...result });
};
