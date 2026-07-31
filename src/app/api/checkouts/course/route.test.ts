import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createPublicCourseCheckout: vi.fn(),
  getCurrentSession: vi.fn(),
  getServerEnv: vi.fn(),
  observeOperation: vi.fn(),
}));

vi.mock("@/features/payments/public-checkout", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/features/payments/public-checkout")
    >();
  return {
    ...original,
    createPublicCourseCheckout: dependencies.createPublicCourseCheckout,
  };
});
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: dependencies.observeOperation,
}));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));
vi.mock("server-only", () => ({}));

import { CheckoutIntentError } from "@/features/payments/checkout";
import { PublicCheckoutRateLimitError } from "@/features/payments/public-checkout";
import { dynamic, POST } from "./route";

const validBody = {
  checkoutAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  courseSlug: "course",
};

const request = (body: unknown): Request =>
  new Request("https://hub.example/api/checkouts/course", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    method: "POST",
  });

describe("POST /api/checkouts/course", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getCurrentSession.mockResolvedValue(null);
    dependencies.getServerEnv.mockReturnValue({
      CLIENT_IP_SOURCE: "x-forwarded-for",
      PAYMENTS_CHECKOUT_MODE: "public",
    });
    dependencies.observeOperation.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) =>
        await execute()
    );
  });

  it.each([
    "disabled",
    "authenticated",
  ] as const)("blocks public checkout in %s mode before dependencies", async (mode) => {
    dependencies.getServerEnv.mockReturnValue({
      CLIENT_IP_SOURCE: "x-forwarded-for",
      PAYMENTS_CHECKOUT_MODE: mode,
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Servico de checkout indisponivel.",
      retryAllowed: false,
      status: "unavailable",
    });
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
    expect(dependencies.observeOperation).not.toHaveBeenCalled();
  });

  it("is dynamic and returns only the safe ready contract", async () => {
    dependencies.createPublicCourseCheckout.mockResolvedValue({
      orderId: "order-id",
      redirectUrl: "https://pay.example/checkout",
      status: "ready",
    });

    const response = await POST(request(validBody));

    expect(dynamic).toBe("force-dynamic");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orderId: "order-id",
      redirectUrl: "https://pay.example/checkout",
      retryAllowed: false,
      status: "ready",
    });
    expect(dependencies.observeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "asaas" })
    );
    expect(dependencies.createPublicCourseCheckout).toHaveBeenCalledWith({
      checkoutAttemptId: validBody.checkoutAttemptId,
      courseSlug: validBody.courseSlug,
      ipAddress: "203.0.113.10",
    });
  });

  it.each([
    ["buyerEmail", "buyer@example.com"],
    ["buyerName", "Buyer"],
    ["price", 10_000],
    ["callback", "https://attacker.example"],
    ["paymentMethod", "PIX"],
    ["cpf", "must-not-be-accepted"],
  ])("rejects the %s body key before session or checkout", async (key, value) => {
    const response = await POST(request({ ...validBody, [key]: value }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Dados de checkout invalidos.",
      retryAllowed: false,
      status: "unavailable",
    });
    expect(dependencies.getCurrentSession).not.toHaveBeenCalled();
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("uses the authenticated student identity from the server-side session", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      platformBlockedReason: null,
      role: "student",
      user: {
        email: "student@example.com",
        id: "student-id",
        name: "Student Name",
      },
    });
    dependencies.createPublicCourseCheckout.mockResolvedValue({
      orderId: "order-id",
      redirectUrl: "https://pay.example/checkout",
      status: "ready",
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(dependencies.createPublicCourseCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticatedBuyer: {
          email: "student@example.com",
          kind: "authenticated",
          name: "Student Name",
          userId: "student-id",
        },
      })
    );
  });

  it.each([
    "admin",
    "support",
  ] as const)("rejects an authenticated %s before checkout", async (role) => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      platformBlockedReason: null,
      role,
      user: {
        email: `${role}@example.com`,
        id: `${role}-id`,
        name: role,
      },
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("rejects a blocked student with a support message", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-07-30T12:00:00.000Z"),
      platformBlockedReason: "internal-only reason",
      role: "student",
      user: {
        email: "blocked@example.com",
        id: "blocked-id",
        name: "Blocked Student",
      },
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).toContain("suporte");
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("maps processing and rejected results without provider details", async () => {
    dependencies.createPublicCourseCheckout.mockResolvedValueOnce({
      orderId: "order-id",
      status: "processing",
    });
    const processing = await POST(request(validBody));
    expect(processing.status).toBe(202);
    await expect(processing.json()).resolves.toEqual({
      orderId: "order-id",
      retryAllowed: false,
      status: "processing",
    });

    dependencies.createPublicCourseCheckout.mockResolvedValueOnce({
      orderId: "order-id",
      status: "failed",
    });
    const failed = await POST(request(validBody));
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({
      orderId: "order-id",
      retryAllowed: true,
      status: "failed",
    });
  });

  it("returns a coordinated Retry-After without exposing identity", async () => {
    dependencies.createPublicCourseCheckout.mockRejectedValue(
      new PublicCheckoutRateLimitError(87)
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("87");
    expect(JSON.stringify(await response.json())).not.toContain(
      "buyer@example.com"
    );
  });

  it.each([
    ["validation", 400],
    ["conflict", 409],
    ["unavailable", 422],
  ] as const)("maps expected %s errors without leaking details", async (kind, status) => {
    dependencies.createPublicCourseCheckout.mockRejectedValue(
      new CheckoutIntentError(kind)
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: "Nao foi possivel iniciar o checkout.",
      retryAllowed: false,
      status: "unavailable",
    });
  });

  it("maps unexpected runtime failures to a generic 503", async () => {
    dependencies.createPublicCourseCheckout.mockRejectedValue(
      new Error("database password and buyer@example.com")
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "buyer@example.com"
    );
  });

  it("maps session failures to a generic 503 without leaking details", async () => {
    dependencies.getCurrentSession.mockRejectedValue(
      new Error("session database password and student@example.com")
    );

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "student@example.com"
    );
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("maps environment preparation failures to a generic 503", async () => {
    dependencies.getServerEnv.mockImplementation(() => {
      throw new Error("invalid secret buyer@example.com");
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Servico de checkout indisponivel.",
      retryAllowed: false,
      status: "unavailable",
    });
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON after the availability guard", async () => {
    const invalidRequest = new Request(
      "https://hub.example/api/checkouts/course",
      {
        body: "{",
        method: "POST",
      }
    );

    const response = await POST(invalidRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Dados de checkout invalidos.",
      retryAllowed: false,
      status: "unavailable",
    });
    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.getCurrentSession).not.toHaveBeenCalled();
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });
});
