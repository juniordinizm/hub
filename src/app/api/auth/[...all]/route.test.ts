import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
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

import { POST } from "./route";

describe("POST /api/auth/[...all]", () => {
  beforeEach(() => {
    dependencies.getServerEnv.mockReturnValue({
      AUTH_PUBLIC_SIGNUP_ENABLED: false,
    });
    dependencies.getAuth.mockReturnValue({
      handler: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    });
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
});
