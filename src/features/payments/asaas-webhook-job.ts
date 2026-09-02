import "server-only";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
import { processAsaasWebhookEvent } from "./asaas-webhook-processor";
import {
  type AsaasWebhookWorkerResult,
  runAsaasWebhookWorker,
} from "./asaas-webhook-worker";

export const runAsaasWebhookJob = async ({
  deadlineMs = scheduledJobs.asaasWebhooks.deadlineMs,
  limit,
}: {
  deadlineMs?: number;
  limit?: number;
} = {}): Promise<
  AsaasWebhookWorkerResult | { reason: "already_running"; skipped: true }
> => {
  const lease = await runWithScheduledJobLease({
    deadlineMs,
    execute: ({ deadlineAt, isLeaseOwner }) =>
      runAsaasWebhookWorker({
        ...(limit === undefined ? {} : { limit }),
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
};
