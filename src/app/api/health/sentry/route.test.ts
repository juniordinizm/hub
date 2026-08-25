import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  emitSentryReadinessEvent: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/sentry-readiness", () => ({
  emitSentryReadinessEvent: dependencies.emitSentryReadinessEvent,
}));

import { POST } from "./route";

const secret = "sentry-readiness-secret-at-least-thirty-two-characters";
const release = "a".repeat(40);
const request = ({
  authorization = `Bearer ${secret}`,
  body = '{"confirmation":"EMIT_SENTRY_READINESS_EVENT"}',
}: {
  authorization?: string;
  body?: string;
} = {}): Request =>
  new Request("https://hub.example.test/api/health/sentry", {
    body,
    headers: { authorization, "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/health/sentry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      NEXT_PUBLIC_SENTRY_RELEASE: release,
      SENTRY_DSN: "https://public@example.ingest.sentry.io/4511808556564480",
      SENTRY_READINESS_SECRET: secret,
      VERCEL_TARGET_ENV: "staging",
    });
    dependencies.emitSentryReadinessEvent.mockResolvedValue({
      correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
      eventId: "event-123",
    });
  });

  it.each([
    [{ VERCEL_TARGET_ENV: "staging" }],
    [{ SENTRY_READINESS_SECRET: secret, VERCEL_ENV: "preview" }],
  ])("returns 404 when the emission surface is unavailable", async (env) => {
    dependencies.getServerEnv.mockReturnValue(env);

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(dependencies.emitSentryReadinessEvent).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid bearer without emitting", async () => {
    const response = await POST(request({ authorization: "Bearer invalid" }));

    expect(response.status).toBe(401);
    expect(dependencies.emitSentryReadinessEvent).not.toHaveBeenCalled();
  });

  it("requires the exact literal confirmation body", async () => {
    const response = await POST(
      request({ body: '{ "confirmation": "EMIT_SENTRY_READINESS_EVENT" }' })
    );

    expect(response.status).toBe(400);
    expect(dependencies.emitSentryReadinessEvent).not.toHaveBeenCalled();
  });

  it("returns only event and correlation identifiers", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
      eventId: "event-123",
    });
    expect(dependencies.emitSentryReadinessEvent).toHaveBeenCalledWith({
      environment: "staging",
      release,
    });
  });
});
