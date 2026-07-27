import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { syncPendingJmvstreamPlayers } from "@/features/jmvstream/server";
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
      const lockResult = await runWithScheduledJobLease({
        deadlineMs: scheduledJobs.jmvstream.deadlineMs,
        execute: ({ deadlineAt, isLeaseOwner }) =>
          syncPendingJmvstreamPlayers(20, deadlineAt, isLeaseOwner),
        jobName: "jmvstream",
        leaseMs: scheduledJobs.jmvstream.leaseMs,
      });

      return lockResult.acquired
        ? lockResult.value
        : { reason: "already_running", skipped: true };
    },
    failureErrorCode: "jmvstream_sync_failed",
    operation: "cron.jmvstream",
    provider: "jmvstream",
  });

  return NextResponse.json(result);
};
