import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createPublicCourseCheckout: vi.fn(),
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
vi.mock("server-only", () => ({}));

import { CheckoutIntentError } from "@/features/payments/checkout";
import { PublicCheckoutRateLimitError } from "@/features/payments/public-checkout";
import { dynamic, POST } from "./route";

const validBody = {
  buyerEmail: "buyer@example.com",
  buyerName: "Buyer",
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
      status: "ready",
    });
    expect(dependencies.observeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "asaas" })
    );
  });

  it("requires exact local identity, attempt and one course identifier", async () => {
    const response = await POST(
      request({ ...validBody, cpf: "must-not-be-accepted" })
    );

    expect(response.status).toBe(400);
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });

  it("maps processing and rejected results without provider details", async () => {
    dependencies.createPublicCourseCheckout.mockResolvedValueOnce({
      orderId: "order-id",
      status: "processing",
    });
    expect((await POST(request(validBody))).status).toBe(202);

    dependencies.createPublicCourseCheckout.mockResolvedValueOnce({
      orderId: "order-id",
      status: "failed",
    });
    const failed = await POST(request(validBody));
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({
      error: "Nao foi possivel iniciar o checkout.",
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

  it("maps environment preparation failures to a generic 503", async () => {
    dependencies.getServerEnv.mockImplementation(() => {
      throw new Error("invalid secret buyer@example.com");
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Servico de checkout indisponivel.",
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
    expect(dependencies.getServerEnv).toHaveBeenCalledOnce();
    expect(dependencies.createPublicCourseCheckout).not.toHaveBeenCalled();
  });
});
