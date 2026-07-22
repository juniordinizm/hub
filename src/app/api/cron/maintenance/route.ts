import { NextResponse } from "next/server";
import { runMaintenance } from "@/features/maintenance/server";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";

export const GET = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const env = getServerEnv();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (
    env.CRON_SECRET ? token !== env.CRON_SECRET : env.NODE_ENV === "production"
  ) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const result = await observeOperation({
    correlationId,
    execute: runMaintenance,
    failureErrorCode: "maintenance_cron_failed",
    operation: "cron.maintenance",
    provider: "database",
  });

  return NextResponse.json({ ok: true, ...result });
};
