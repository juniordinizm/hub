import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createAsaasCheckoutIntent: vi.fn(),
  getServerEnv: vi.fn(),
  redirect: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/checkout", () => ({
  createAsaasCheckoutIntent: dependencies.createAsaasCheckoutIntent,
}));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: (path: string) => `https://hub.example${path}`,
  getAsaasProviderClient: () => ({ createCheckout: vi.fn() }),
}));
vi.mock("@/features/payments/refunds", () => ({
  issueRefundConfirmation: vi.fn(),
  requestFullRefund: vi.fn(),
}));
vi.mock("@/features/payments/reconciliation", () => ({
  importAsaasFinancialStatement: vi.fn(),
  reconcileAsaasPayment: vi.fn(),
}));
vi.mock("@/features/payments/asaas-webhook-worker", () => ({
  requeueFailedAsaasWebhook: vi.fn(),
}));
vi.mock("@/features/payments/server", () => ({
  resolvePaymentReview: vi.fn(),
  retryFailedAbacatePayWebhook: vi.fn(),
}));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import { startCourseCheckoutAction } from "./actions";

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";
const COURSE_ID = "4a45d650-fc63-44c9-b2d1-6c73d52de84c";

describe("authenticated checkout action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      PAYMENTS_CHECKOUT_MODE: "public",
    });
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: {
        email: "session@example.com",
        id: "session-user",
        name: "Session User",
      },
    });
  });

  it("blocks disabled checkout before session and provider", async () => {
    dependencies.getServerEnv.mockReturnValue({
      PAYMENTS_CHECKOUT_MODE: "disabled",
    });
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);

    await expect(startCourseCheckoutAction(form)).rejects.toThrow(
      "Checkout indisponivel."
    );
    expect(dependencies.requireSession).not.toHaveBeenCalled();
    expect(dependencies.createAsaasCheckoutIntent).not.toHaveBeenCalled();
  });

  it("uses only session identity and redirects a ready checkout", async () => {
    dependencies.createAsaasCheckoutIntent.mockResolvedValue({
      orderId: ATTEMPT_ID,
      redirectUrl: "https://pay.example/checkout",
      status: "ready",
    });
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);
    form.set("buyerEmail", "attacker@example.com");
    form.set("buyerName", "Attacker");

    await startCourseCheckoutAction(form);

    expect(dependencies.createAsaasCheckoutIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: ATTEMPT_ID,
        buyer: {
          email: "session@example.com",
          kind: "authenticated",
          name: "Session User",
          userId: "session-user",
        },
        callbacks: {
          cancelUrl: "https://hub.example/checkout/cancelado",
          expiredUrl: "https://hub.example/checkout/expirado",
          successUrl: `https://hub.example/app/checkout/sucesso?courseId=${COURSE_ID}`,
        },
      })
    );
    expect(dependencies.redirect).toHaveBeenCalledWith(
      "https://pay.example/checkout"
    );
  });

  it("redirects uncertain creation to safe tracking and rejects failed creation", async () => {
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);
    dependencies.createAsaasCheckoutIntent.mockResolvedValueOnce({
      orderId: ATTEMPT_ID,
      status: "processing",
    });

    await startCourseCheckoutAction(form);
    expect(dependencies.redirect).toHaveBeenLastCalledWith(
      `/app/checkout/sucesso?courseId=${COURSE_ID}`
    );

    dependencies.createAsaasCheckoutIntent.mockResolvedValueOnce({
      orderId: ATTEMPT_ID,
      status: "failed",
    });
    await expect(startCourseCheckoutAction(form)).rejects.toThrow(
      "Nao foi possivel iniciar o checkout."
    );
  });
});
