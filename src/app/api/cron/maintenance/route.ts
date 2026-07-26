import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { runMaintenance } from "@/features/maintenance/server";
import { runWithScheduledJobLease } from "@/features/operations/scheduled-job-lease";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
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
        deadlineMs: scheduledJobs.maintenance.deadlineMs,
        execute: ({ deadlineAt, isLeaseOwner }) =>
          runMaintenance({ deadlineAt, isLeaseOwner }),
        jobName: "maintenance",
        leaseMs: scheduledJobs.maintenance.leaseMs,
      });
      return lease.acquired
        ? lease.value
        : { reason: "already_running", skipped: true };
    },
    failureErrorCode: "maintenance_cron_failed",
    operation: "cron.maintenance",
    provider: "database",
  });

  return NextResponse.json({ ok: true, ...result });
};
