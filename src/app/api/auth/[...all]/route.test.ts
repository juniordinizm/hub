import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getCurrentSession: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));
vi.mock("@/lib/auth-policy", () => ({
  isBlockedAuthEndpoint: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn().mockReturnValue("test-correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));

import { POST } from "./route";

describe("POST /api/auth/[...all]", () => {
  beforeEach(() => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: false,
    });
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    });
    dependencies.getCurrentSession.mockResolvedValue(null);
  });

  it("records a failed sign-in without account data", async () => {
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    });

    await POST(new Request("https://hub.example.test/api/auth/sign-in/email"), {
      params: Promise.resolve({ all: ["sign-in", "email"] }),
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "test-correlation-id",
        errorCode: "auth_rate_limited",
        httpStatus: 429,
        operation: "auth.sign_in",
        outcome: "failure",
      })
    );
  });

  it("records successful sign-in separately", async () => {
    await POST(new Request("https://hub.example.test/api/auth/sign-in/email"), {
      params: Promise.resolve({ all: ["sign-in", "email"] }),
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "auth.sign_in",
        outcome: "success",
      })
    );
  });

  it("denies privileged two-factor disable before delegating", async () => {
    const handler = vi.fn();
    dependencies.getAuth.mockReturnValue({ handler });
    dependencies.getCurrentSession.mockResolvedValue({
      role: "support",
      twoFactorEnabled: true,
      user: { id: "support-user" },
    });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/two-factor/disable", {
        body: JSON.stringify({ password: "must-not-be-read" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["two-factor", "disable"] }) }
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("prevents privileged two-factor secret replacement", async () => {
    const handler = vi.fn();
    dependencies.getAuth.mockReturnValue({ handler });
    dependencies.getCurrentSession.mockResolvedValue({
      role: "admin",
      twoFactorEnabled: true,
      user: { id: "admin-user" },
    });

    const response = await POST(
      new Request("https://hub.example.test/api/auth/two-factor/enable", {
        body: JSON.stringify({ password: "must-not-be-read" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ all: ["two-factor", "enable"] }) }
    );

    expect(response.status).toBe(409);
    expect(handler).not.toHaveBeenCalled();
  });

  it("delegates initial privileged two-factor enrollment", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getAuth.mockReturnValue({ handler });
    dependencies.getCurrentSession.mockResolvedValue({
      role: "admin",
      twoFactorEnabled: false,
      user: { id: "admin-user" },
    });
    const request = new Request(
      "https://hub.example.test/api/auth/two-factor/enable",
      { method: "POST" }
    );

    const response = await POST(request, {
      params: Promise.resolve({ all: ["two-factor", "enable"] }),
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request);
  });
});
