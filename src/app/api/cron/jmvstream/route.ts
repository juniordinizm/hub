import { NextResponse } from "next/server";
import { getPool } from "@/db";
import { syncPendingJmvstreamPlayers } from "@/features/jmvstream/server";
import { runWithAdvisoryLock } from "@/features/operations/advisory-lock";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import { observeOperation } from "@/lib/observe-operation";

export const dynamic = "force-dynamic";

const JMVSTREAM_SYNC_LOCK_ID = 2_040_701;

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const GET = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  const env = getServerEnv();
  const receivedToken = getBearerToken(request.headers.get("authorization"));

  if (env.CRON_SECRET) {
    if (receivedToken !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado." },
      { status: 503 }
    );
  }

  const result = await observeOperation({
    correlationId,
    execute: async () => {
      const lockResult = await runWithAdvisoryLock({
        connect: () => getPool().connect(),
        execute: syncPendingJmvstreamPlayers,
        lockId: JMVSTREAM_SYNC_LOCK_ID,
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
