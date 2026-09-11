import { withMonitor } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { scheduledJobs } from "@/config/scheduled-jobs";
import { getScheduledJobEarlyResponse } from "@/features/operations/scheduled-job-request";
import { runOutboxJob } from "@/features/outbox/outbox-job";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment";

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

  const run = () =>
    observeOperation({
      correlationId,
      execute: () => runOutboxJob(),
      failureErrorCode: "outbox_worker_failed",
      operation: "cron.outbox",
    });
  const result =
    resolveRuntimeEnvironment(process.env) === "production"
      ? await withMonitor("hub-outbox-production", run, {
          checkinMargin: 5,
          failureIssueThreshold: 2,
          isolateTrace: true,
          maxRuntime: 5,
          recoveryThreshold: 1,
          schedule: {
            type: "crontab",
            value: scheduledJobs.outbox.schedule,
          },
          timezone: "UTC",
        })
      : await run();

  return NextResponse.json({ ok: true, ...result });
};
