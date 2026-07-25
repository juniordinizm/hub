import { NextResponse } from "next/server";
import { getReadinessPool } from "@/db";
import { checkDatabaseReadiness } from "@/features/operations/readiness";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const GET = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );

  if (env.NODE_ENV === "production" && !env.HEALTHCHECK_SECRET) {
    logOperationalEvent({
      correlationId,
      errorCode: "healthcheck_secret_missing",
      operation: "health.readiness",
      outcome: "failure",
    });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (
    env.HEALTHCHECK_SECRET &&
    getBearerToken(request.headers.get("authorization")) !==
      env.HEALTHCHECK_SECRET
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startedAt = Date.now();
  const readiness = await checkDatabaseReadiness({
    connect: () => getReadinessPool().connect(),
  });
  const durationMs = Date.now() - startedAt;

  logOperationalEvent({
    correlationId,
    durationMs,
    ...(readiness.ready ? {} : { errorCode: "database_unavailable" }),
    operation: "health.readiness",
    outcome: readiness.ready ? "success" : "failure",
    provider: "database",
  });

  return NextResponse.json(
    readiness.ready
      ? {
          ok: true,
          service: "protea-r-hub",
          timestamp: new Date().toISOString(),
        }
      : { ok: false },
    { status: readiness.ready ? 200 : 503 }
  );
};
