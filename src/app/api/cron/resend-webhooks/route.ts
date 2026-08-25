import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runResendWebhookWorker } from "@/features/email-delivery/runner";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
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
    execute: async () => {
      const lease = await runWithScheduledJobLease({
        deadlineMs: scheduledJobs["resend-webhooks"].deadlineMs,
        execute: ({ deadlineAt, isLeaseOwner }) =>
          runResendWebhookWorker({
            deadlineAt,
            shouldContinue: isLeaseOwner,
          }),
        jobName: "resend-webhooks",
        leaseMs: scheduledJobs["resend-webhooks"].leaseMs,
      });
      return lease.acquired
        ? lease.value
        : { reason: "already_running", skipped: true };
    },
    failureErrorCode: "resend_webhook_worker_failed",
    operation: "cron.resend_webhooks",
    provider: "resend",
  });
  return NextResponse.json({ ok: true, ...result });
};
