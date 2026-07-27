import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const getScheduledJobEarlyResponse = (
  request: Request
): Response | null => {
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

  if (!env.SCHEDULED_JOBS_ENABLED) {
    return NextResponse.json({
      ok: true,
      reason: "scheduled_jobs_disabled",
      skipped: true,
    });
  }

  return null;
};
