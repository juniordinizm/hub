import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createAsaasCheckoutIntent: vi.fn(),
  getApplicationUrl: vi.fn((path: string) => `https://hub.example${path}`),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query: dependencies.query }) }));
vi.mock("@/features/payments/checkout", () => ({
  createAsaasCheckoutIntent: dependencies.createAsaasCheckoutIntent,
}));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: dependencies.getApplicationUrl,
  getAsaasProviderClient: vi.fn(() => ({ createCheckout: vi.fn() })),
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_SECRET: "test-secret" }),
}));

import {
  authorizePublicCheckoutIntent,
  createPublicCourseCheckout,
  PublicCheckoutRateLimitError,
} from "./public-checkout";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

describe("public checkout boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adapts local buyer identity and public callbacks to the shared core", async () => {
    dependencies.createAsaasCheckoutIntent.mockResolvedValue({
      orderId: "order-id",
      redirectUrl: "https://pay.example/checkout",
      status: "ready",
    });

    await createPublicCourseCheckout({
      buyerEmail: "buyer@example.com",
      buyerName: "Buyer Name",
      checkoutAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
      courseSlug: "canonical-course",
      ipAddress: "203.0.113.10",
    });

    expect(dependencies.createAsaasCheckoutIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
        buyer: {
          email: "buyer@example.com",
          kind: "public",
          name: "Buyer Name",
        },
        callbacks: {
          cancelUrl: "https://hub.example/checkout/cancelado",
          expiredUrl: "https://hub.example/checkout/expirado",
          successUrl: "https://hub.example/checkout/sucesso",
        },
        courseSlug: "canonical-course",
      })
    );
  });

  it("stores only an HMAC key and consumes a coordinated database window", async () => {
    dependencies.query.mockResolvedValueOnce({
      rows: [{ expires_at: new Date("2026-07-29T12:10:00.000Z") }],
    });

    await authorizePublicCheckoutIntent({
      courseId: "course-id",
      ipAddress: "203.0.113.10",
      now: new Date("2026-07-29T12:00:00.000Z"),
      secret: "rate-limit-secret",
    });

    const [sql, values] = dependencies.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain("on conflict (key_hash) do update");
    expect(sql).toContain("request_count < $3");
    expect(sql).toContain("$2::timestamptz + interval '10 minutes'");
    expect(values[0]).toMatch(SHA256_HEX_PATTERN);
    expect(values).not.toContain("203.0.113.10");
    expect(values).not.toContain("course-id");
    expect(values[2]).toBe(5);
  });

  it("returns the remaining coordinated window when the limit is exhausted", async () => {
    dependencies.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ expires_at: new Date("2026-07-29T12:03:21.000Z") }],
      });

    await expect(
      authorizePublicCheckoutIntent({
        courseId: "course-id",
        ipAddress: "203.0.113.10",
        now: new Date("2026-07-29T12:00:00.000Z"),
        secret: "rate-limit-secret",
      })
    ).rejects.toEqual(new PublicCheckoutRateLimitError(201));
  });
});
