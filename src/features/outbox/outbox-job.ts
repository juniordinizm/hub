import "server-only";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
import { runOutboxWorker } from "./runner";

export const runOutboxJob = async ({
  deadlineMs = scheduledJobs.outbox.deadlineMs,
  limit,
}: {
  deadlineMs?: number;
  limit?: number;
} = {}): Promise<
  | Awaited<ReturnType<typeof runOutboxWorker>>
  | { reason: "already_running"; skipped: true }
> => {
  const lease = await runWithScheduledJobLease({
    deadlineMs,
    execute: ({ deadlineAt, isLeaseOwner }) =>
      runOutboxWorker({
        ...(limit === undefined ? {} : { limit }),
        deadlineAt,
        shouldContinue: isLeaseOwner,
      }),
    jobName: "outbox",
    leaseMs: scheduledJobs.outbox.leaseMs,
  });

  return lease.acquired
    ? lease.value
    : { reason: "already_running", skipped: true };
};
