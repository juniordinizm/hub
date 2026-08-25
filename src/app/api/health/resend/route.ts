import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/db";
import { sendPasswordResetEmail } from "@/features/email/server";
import { getServerEnv } from "@/lib/env";
import { logOperationalEvent } from "@/lib/observability";
import { resolveRuntimeEnvironment } from "@/lib/runtime-environment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION_BODY = '{"confirmation":"EMIT_RESEND_READINESS_EMAIL"}';

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

const parseAllowlist = (value: string): string[] => [
  ...new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  ),
];

export const POST = async (request: Request): Promise<Response> => {
  const env = getServerEnv();
  const environment = resolveRuntimeEnvironment({
    NODE_ENV: env.NODE_ENV,
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_TARGET_ENV: env.VERCEL_TARGET_ENV,
  });
  if (
    environment !== "staging" ||
    !env.RESEND_READINESS_SECRET ||
    !env.STAGING_EMAIL_RECIPIENT_ALLOWLIST
  ) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      env.RESEND_READINESS_SECRET
    )
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if ((await request.text()) !== CONFIRMATION_BODY) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const correlationId = crypto.randomUUID();
  try {
    const allowlist = parseAllowlist(env.STAGING_EMAIL_RECIPIENT_ALLOWLIST);
    const result = await getPool().query<{ email: string; name: string }>(
      `
        select email, name
        from users
        where lower(email) = any($1::text[])
        order by id
        limit 1
      `,
      [allowlist]
    );
    const recipient = result.rows[0];
    if (!recipient) {
      throw new Error("Controlled Staging recipient is unavailable.");
    }
    const idempotencyKey = `resend.readiness/${correlationId}/v1`;
    await sendPasswordResetEmail({
      deliveryContext: {
        correlationId,
        idempotencyKey,
        topic: "auth.password-reset",
      },
      idempotencyKey,
      resetUrl: `${env.NEXT_PUBLIC_APP_URL}/redefinir-senha`,
      to: recipient.email,
      userName: recipient.name,
    });
    return NextResponse.json({ correlationId });
  } catch {
    logOperationalEvent({
      correlationId,
      errorCode: "resend_readiness_emission_failed",
      httpStatus: 503,
      operation: "health.resend_readiness",
      outcome: "failure",
      provider: "resend",
    });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
};
