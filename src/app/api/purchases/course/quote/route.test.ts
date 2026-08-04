import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getClientIpAddress: vi.fn(() => "203.0.113.10"),
  getPublicCoursePaymentQuote: vi.fn(),
  getServerEnv: vi.fn(() => ({ CLIENT_IP_SOURCE: "x-forwarded-for" })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/public-payment-quote", () => ({
  getPublicCoursePaymentQuote: dependencies.getPublicCoursePaymentQuote,
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIpAddress: dependencies.getClientIpAddress,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { GET } from "./route";

describe("GET /api/purchases/course/quote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the public quote contract with no-store", async () => {
    dependencies.getPublicCoursePaymentQuote.mockResolvedValue({
      cardOptions: [{ count: 1, grossAmountInCents: 10_000 }],
      expiresAt: "2026-08-03T15:30:00.000Z",
      installmentsTemporarilyUnavailable: false,
      pix: { grossAmountInCents: 10_000 },
      quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
    });

    const response = await GET(
      new Request(
        "https://hub.example/api/purchases/course/quote?courseSlug=curso"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.getPublicCoursePaymentQuote).toHaveBeenCalledWith({
      courseSlug: "curso",
      ipAddress: "203.0.113.10",
    });
    expect(JSON.stringify(await response.json())).not.toContain("fee");
  });

  it.each([
    "",
    "?courseSlug=Curso Invalido",
    "?courseSlug=curso&extra=true",
  ])("rejects an invalid exact query: %s", async (query) => {
    const response = await GET(
      new Request(`https://hub.example/api/purchases/course/quote${query}`)
    );

    expect(response.status).toBe(400);
    expect(dependencies.getPublicCoursePaymentQuote).not.toHaveBeenCalled();
  });

  it("maps provider or database failures without leaking details", async () => {
    dependencies.getPublicCoursePaymentQuote.mockRejectedValue(
      new Error("api-key buyer@example.com")
    );

    const response = await GET(
      new Request(
        "https://hub.example/api/purchases/course/quote?courseSlug=curso"
      )
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("api-key");
  });
});
