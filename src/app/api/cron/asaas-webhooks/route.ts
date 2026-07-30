import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import { processAsaasWebhookEvent } from "@/features/payments/asaas-webhook-processor";
import { runAsaasWebhookWorker } from "@/features/payments/asaas-webhook-worker";
import { getServerEnv } from "@/lib/env";
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
  if (!getServerEnv().ASAAS_WEBHOOK_ENABLED) {
    return NextResponse.json({
      ok: true,
      reason: "asaas_webhook_disabled",
      skipped: true,
    });
  }

  const result = await observeOperation({
    correlationId,
    execute: async () => {
      const lease = await runWithScheduledJobLease({
        deadlineMs: scheduledJobs.asaasWebhooks.deadlineMs,
        execute: ({ deadlineAt, isLeaseOwner }) =>
          runAsaasWebhookWorker({
            deadlineAt,
            processor: processAsaasWebhookEvent,
            shouldContinue: isLeaseOwner,
          }),
        jobName: "asaas-webhooks",
        leaseMs: scheduledJobs.asaasWebhooks.leaseMs,
      });
      return lease.acquired
        ? lease.value
        : { reason: "already_running", skipped: true };
    },
    failureErrorCode: "asaas_webhook_worker_failed",
    operation: "cron.asaas-webhooks",
    provider: "asaas",
  });

  return NextResponse.json({ ok: true, ...result });
};
