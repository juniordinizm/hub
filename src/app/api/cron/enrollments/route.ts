import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { processEnrollmentMaintenance } from "@/features/enrollments/maintenance";
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
        deadlineMs: scheduledJobs.enrollments.deadlineMs,
        execute: ({ deadlineAt, isLeaseOwner, ownerToken }) =>
          processEnrollmentMaintenance({
            deadlineAt,
            isLeaseOwner,
            ownerToken,
          }),
        jobName: "enrollments",
        leaseMs: scheduledJobs.enrollments.leaseMs,
      });
      return lease.acquired
        ? lease.value
        : { reason: "already_running", skipped: true };
    },
    failureErrorCode: "enrollment_maintenance_failed",
    operation: "cron.enrollments",
    provider: "database",
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
};
