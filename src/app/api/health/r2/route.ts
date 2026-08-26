import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkR2ObjectStorage } from "@/features/storage/r2";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const hasValidBearer = (
  authorization: string | null,
  expectedSecret: string
): boolean => {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const supplied = Buffer.from(authorization.slice("Bearer ".length).trim());
  const expected = Buffer.from(expectedSecret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
};

export const GET = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );

  if (!env.HEALTHCHECK_SECRET) {
    logOperationalEvent({
      correlationId,
      errorCode: "healthcheck_secret_missing",
      httpStatus: 503,
      operation: "health.r2",
      outcome: "failure",
      provider: "r2",
    });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      env.HEALTHCHECK_SECRET
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    await checkR2ObjectStorage();
    return NextResponse.json({
      correlationId,
      durationMs: Date.now() - startedAt,
      ok: true,
      provider: "r2",
    });
  } catch {
    logOperationalEvent({
      correlationId,
      durationMs: Date.now() - startedAt,
      errorCode: "r2_unavailable",
      httpStatus: 503,
      operation: "health.r2",
      outcome: "failure",
      provider: "r2",
    });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
};
