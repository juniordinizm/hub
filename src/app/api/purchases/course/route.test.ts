import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createPublicCourseInvoicePurchase: vi.fn(),
  getClientIpAddress: vi.fn(() => "203.0.113.10"),
  getCurrentSession: vi.fn<() => Promise<unknown>>(async () => null),
  getServerEnv: vi.fn(() => ({ CLIENT_IP_SOURCE: "x-forwarded-for" })),
  readPublicInvoiceStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/public-invoice-purchase", () => ({
  createPublicCourseInvoicePurchase:
    dependencies.createPublicCourseInvoicePurchase,
}));
vi.mock("@/features/payments/public-invoice-recovery", () => ({
  readPublicInvoiceStatus: dependencies.readPublicInvoiceStatus,
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIpAddress: dependencies.getClientIpAddress,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));

import { GET, POST } from "./route";

const body = {
  courseSlug: "curso",
  cpfCnpj: "390.533.447-05",
  email: "buyer@example.com",
  installmentCount: 3,
  name: "Compradora",
  paymentMethod: "credit_card",
  purchaseAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
};

const request = (value: unknown) =>
  new Request("https://hub.example/api/purchases/course", {
    body: JSON.stringify(value),
    method: "POST",
  });

describe("POST /api/purchases/course", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the hosted invoice URL without echoing buyer data", async () => {
    dependencies.createPublicCourseInvoicePurchase.mockResolvedValue({
      orderId: body.purchaseAttemptId,
      redirectUrl: "https://sandbox.asaas.com/i/pay_asaas",
      status: "ready",
    });

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      orderId: body.purchaseAttemptId,
      redirectUrl: "https://sandbox.asaas.com/i/pay_asaas",
      status: "ready",
    });
    expect(JSON.stringify(responseBody)).not.toContain(body.email);
    expect(dependencies.createPublicCourseInvoicePurchase).toHaveBeenCalledWith(
      {
        input: { ...body, cpfCnpj: "39053344705" },
        ipAddress: "203.0.113.10",
      }
    );
  });

  it("rejects team sessions and mismatched student identity", async () => {
    dependencies.getCurrentSession.mockResolvedValueOnce({
      platformBlockedAt: null,
      role: "admin",
      user: { email: "admin@example.com", id: "admin", name: "Admin" },
    });
    expect((await POST(request(body))).status).toBe(403);

    dependencies.getCurrentSession.mockResolvedValueOnce({
      platformBlockedAt: null,
      role: "student",
      user: { email: "other@example.com", id: "student", name: "Student" },
    });
    expect((await POST(request(body))).status).toBe(403);
    expect(
      dependencies.createPublicCourseInvoicePurchase
    ).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies before external effects", async () => {
    const response = await POST(request({ ...body, amount: 1 }));

    expect(response.status).toBe(400);
    expect(
      dependencies.createPublicCourseInvoicePurchase
    ).not.toHaveBeenCalled();
  });
});

describe("GET /api/purchases/course", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recovers only the exact attempt and slug without cache", async () => {
    dependencies.readPublicInvoiceStatus.mockResolvedValue({
      orderId: body.purchaseAttemptId,
      status: "processing",
    });
    const response = await GET(
      new Request(
        `https://hub.example/api/purchases/course?purchaseAttemptId=${body.purchaseAttemptId}&courseSlug=curso`
      )
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.readPublicInvoiceStatus).toHaveBeenCalledWith({
      courseSlug: "curso",
      purchaseAttemptId: body.purchaseAttemptId,
    });
  });
});
