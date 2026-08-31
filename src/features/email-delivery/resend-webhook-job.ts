import "server-only";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
import { runResendWebhookWorker } from "./runner";

export const runResendWebhookJob = async ({
  deadlineMs = scheduledJobs["resend-webhooks"].deadlineMs,
  limit,
}: {
  deadlineMs?: number;
  limit?: number;
} = {}): Promise<
  | Awaited<ReturnType<typeof runResendWebhookWorker>>
  | { reason: "already_running"; skipped: true }
> => {
  const lease = await runWithScheduledJobLease({
    deadlineMs,
    execute: ({ deadlineAt, isLeaseOwner }) =>
      runResendWebhookWorker({
        ...(limit === undefined ? {} : { limit }),
        deadlineAt,
        shouldContinue: isLeaseOwner,
      }),
    jobName: "resend-webhooks",
    leaseMs: scheduledJobs["resend-webhooks"].leaseMs,
  });

  return lease.acquired
    ? lease.value
    : { reason: "already_running", skipped: true };
};
