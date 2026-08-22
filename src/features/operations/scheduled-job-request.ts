import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

const getBearerToken = (authorization: string | null): string | null => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

const matchesCronSecret = (
  expectedSecret: string,
  receivedToken: string | null
): boolean => {
  if (!receivedToken) {
    return false;
  }

  return timingSafeEqual(
    createHash("sha256").update(expectedSecret, "utf8").digest(),
    createHash("sha256").update(receivedToken, "utf8").digest()
  );
};

export const getScheduledJobEarlyResponse = (
  request: Request
): Response | null => {
  const env = getServerEnv();
  const receivedToken = getBearerToken(request.headers.get("authorization"));

  if (env.CRON_SECRET) {
    if (!matchesCronSecret(env.CRON_SECRET, receivedToken)) {
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
