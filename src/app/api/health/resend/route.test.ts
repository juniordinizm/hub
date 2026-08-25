import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
  query: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/email/server", () => ({
  sendPasswordResetEmail: dependencies.sendPasswordResetEmail,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import { POST } from "./route";

const secret = "resend-readiness-secret-at-least-thirty-two-characters";
const UUID = /^[0-9a-f-]{36}$/u;
const request = ({
  authorization = `Bearer ${secret}`,
  body = '{"confirmation":"EMIT_RESEND_READINESS_EMAIL"}',
}: {
  authorization?: string;
  body?: string;
} = {}): Request =>
  new Request("https://hub.example.test/api/health/resend", {
    body,
    headers: { authorization, "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/health/resend", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getPool.mockReturnValue({ query: dependencies.query });
    dependencies.getServerEnv.mockReturnValue({
      NEXT_PUBLIC_APP_URL: "https://preview.neurocapacitar.com.br",
      RESEND_READINESS_SECRET: secret,
      STAGING_EMAIL_RECIPIENT_ALLOWLIST:
        "controlled@example.test, CONTROLLED@example.test",
      VERCEL_TARGET_ENV: "staging",
    });
    dependencies.query.mockResolvedValue({
      rows: [{ email: "controlled@example.test", name: "Controlled" }],
    });
    dependencies.sendPasswordResetEmail.mockResolvedValue({ id: "provider-1" });
  });

  it("is unavailable outside a configured Staging target", async () => {
    dependencies.getServerEnv.mockReturnValue({
      RESEND_READINESS_SECRET: secret,
      STAGING_EMAIL_RECIPIENT_ALLOWLIST: "controlled@example.test",
      VERCEL_TARGET_ENV: "production",
    });

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(dependencies.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("requires the bearer and exact confirmation before querying", async () => {
    expect(
      (await POST(request({ authorization: "Bearer invalid" }))).status
    ).toBe(401);
    expect(
      (await POST(request({ body: '{ "confirmation": "x" }' }))).status
    ).toBe(400);
    expect(dependencies.query).not.toHaveBeenCalled();
  });

  it("selects only an existing allowlisted account and returns a UUID", async () => {
    const response = await POST(request());
    const body = (await response.json()) as { correlationId: string };

    expect(response.status).toBe(200);
    expect(body.correlationId).toMatch(UUID);
    expect(dependencies.query).toHaveBeenCalledWith(
      expect.stringContaining("lower(email) = any"),
      [["controlled@example.test"]]
    );
    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      deliveryContext: {
        correlationId: body.correlationId,
        idempotencyKey: `resend.readiness/${body.correlationId}/v1`,
        topic: "auth.password-reset",
      },
      idempotencyKey: `resend.readiness/${body.correlationId}/v1`,
      resetUrl: "https://preview.neurocapacitar.com.br/redefinir-senha",
      to: "controlled@example.test",
      userName: "Controlled",
    });
  });

  it("fails without exposing provider or recipient details", async () => {
    dependencies.query.mockResolvedValue({ rows: [] });

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      correlationId: expect.any(String),
      errorCode: "resend_readiness_emission_failed",
      httpStatus: 503,
      operation: "health.resend_readiness",
      outcome: "failure",
      provider: "resend",
    });
  });
});
