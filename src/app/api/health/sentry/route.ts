import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment";
import { emitSentryReadinessEvent } from "@/lib/sentry-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION_BODY = '{"confirmation":"EMIT_SENTRY_READINESS_EVENT"}';

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

export const POST = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const environment = resolveRuntimeEnvironment({
    NODE_ENV: env.NODE_ENV,
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_TARGET_ENV: env.VERCEL_TARGET_ENV,
  });

  if (
    !env.SENTRY_READINESS_SECRET ||
    (environment !== "production" && environment !== "staging")
  ) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      env.SENTRY_READINESS_SECRET
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if ((await request.text()) !== CONFIRMATION_BODY) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!(env.SENTRY_DSN && env.NEXT_PUBLIC_SENTRY_RELEASE)) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  try {
    const evidence = await emitSentryReadinessEvent({
      environment,
      release: env.NEXT_PUBLIC_SENTRY_RELEASE,
    });
    return NextResponse.json(evidence);
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
};
