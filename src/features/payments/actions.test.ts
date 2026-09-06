import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createAsaasCheckoutIntent: vi.fn(),
  createCheckoutCallbacks: vi.fn((attemptId: string) => ({
    cancelUrl: `https://hub.example/checkout/cancelado?attemptId=${attemptId}`,
    expiredUrl: `https://hub.example/checkout/expirado?attemptId=${attemptId}`,
    successUrl: "https://hub.example/checkout/sucesso",
  })),
  getServerEnv: vi.fn(),
  importAsaasFinancialStatement: vi.fn(),
  issueRefundConfirmation: vi.fn(),
  redirect: vi.fn(),
  reconcileAsaasPayment: vi.fn(),
  requeueFailedAsaasWebhook: vi.fn(),
  requirePermission: vi.fn(),
  requireSession: vi.fn(),
  requestFullRefund: vi.fn(),
  resolvePaymentReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/checkout", () => ({
  createAsaasCheckoutIntent: dependencies.createAsaasCheckoutIntent,
  createCheckoutCallbacks: dependencies.createCheckoutCallbacks,
}));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: (path: string) => `https://hub.example${path}`,
  getAsaasProviderClient: () => ({ createCheckout: vi.fn() }),
}));
vi.mock("@/features/payments/refunds", () => ({
  issueRefundConfirmation: dependencies.issueRefundConfirmation,
  requestFullRefund: dependencies.requestFullRefund,
}));
vi.mock("@/features/payments/reconciliation", () => ({
  importAsaasFinancialStatement: dependencies.importAsaasFinancialStatement,
  reconcileAsaasPayment: dependencies.reconcileAsaasPayment,
}));
vi.mock("@/features/payments/asaas-webhook-worker", () => ({
  requeueFailedAsaasWebhook: dependencies.requeueFailedAsaasWebhook,
}));
vi.mock("@/features/payments/payment-reviews", () => ({
  resolvePaymentReview: dependencies.resolvePaymentReview,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import {
  confirmRefundPasswordAction,
  importAsaasStatementAction,
  reconcileAsaasPaymentAction,
  requestFullRefundAction,
  resolvePaymentReviewAction,
  retryFailedAsaasWebhookAction,
  startCourseCheckoutAction,
} from "./actions";

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";
const COURSE_ID = "4a45d650-fc63-44c9-b2d1-6c73d52de84c";
const SCHEDULE_DIGEST = "a".repeat(64);

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

  it.each([
    "admin",
    "support",
  ] as const)("rejects a %s session before starting checkout", async (role) => {
    dependencies.requireSession.mockResolvedValue({
      role,
      user: {
        email: `${role}@example.com`,
        id: `${role}-user`,
        name: role,
      },
    });
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);

    await expect(startCourseCheckoutAction(form)).rejects.toThrow(
      "Apenas alunos podem iniciar checkout."
    );
    expect(dependencies.createAsaasCheckoutIntent).not.toHaveBeenCalled();
  });

  it("preserves the session boundary for a blocked student account", async () => {
    const blockedAccountError = new Error("blocked session redirect");
    dependencies.requireSession.mockRejectedValue(blockedAccountError);
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);

    await expect(startCourseCheckoutAction(form)).rejects.toBe(
      blockedAccountError
    );
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
    form.set("expectedContentReleaseScheduleDigest", SCHEDULE_DIGEST);
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
          cancelUrl: `https://hub.example/checkout/cancelado?attemptId=${ATTEMPT_ID}`,
          expiredUrl: `https://hub.example/checkout/expirado?attemptId=${ATTEMPT_ID}`,
          successUrl: `https://hub.example/app/checkout/sucesso?courseId=${COURSE_ID}`,
        },
      })
    );
    expect(dependencies.createCheckoutCallbacks).toHaveBeenCalledWith(
      ATTEMPT_ID
    );
    expect(dependencies.redirect).toHaveBeenCalledWith(
      "https://pay.example/checkout"
    );
  });

  it("redirects uncertain creation to safe tracking and rejects failed creation", async () => {
    const form = new FormData();
    form.set("courseId", COURSE_ID);
    form.set("checkoutAttemptId", ATTEMPT_ID);
    form.set("expectedContentReleaseScheduleDigest", SCHEDULE_DIGEST);
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

describe("financial mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      user: { id: "admin-user" },
    });
  });

  it("requires mutable financial access to reconcile a payment", async () => {
    const form = new FormData();
    form.set("orderId", ATTEMPT_ID);

    await reconcileAsaasPaymentAction(form);

    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageFinancialOperations"
    );
    expect(dependencies.reconcileAsaasPayment).toHaveBeenCalledWith({
      actorUserId: "admin-user",
      orderId: ATTEMPT_ID,
    });
  });

  it("requires mutable financial access to import a statement", async () => {
    dependencies.importAsaasFinancialStatement.mockResolvedValue({
      completed: true,
      inserted: 2,
      resumedFromOffset: 0,
      updated: 1,
    });
    const form = new FormData();
    form.set("startDate", "2026-07-01");
    form.set("finishDate", "2026-07-30");

    await expect(importAsaasStatementAction(form)).resolves.toEqual({
      completed: true,
      inserted: 2,
      resumedFromOffset: 0,
      updated: 1,
    });
    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageFinancialOperations"
    );
    expect(dependencies.importAsaasFinancialStatement).toHaveBeenCalledWith({
      actorUserId: "admin-user",
      finishDate: "2026-07-30",
      startDate: "2026-07-01",
    });
  });

  it("requires mutable review access to resolve a payment review", async () => {
    const form = new FormData();
    form.set("reviewId", ATTEMPT_ID);
    form.set("decision", "rejected");
    form.set("decisionReason", "evidencia insuficiente");

    await resolvePaymentReviewAction(form);

    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageFinancialReviews"
    );
    expect(dependencies.resolvePaymentReview).toHaveBeenCalledWith({
      actorUserId: "admin-user",
      decision: "rejected",
      decisionReason: "evidencia insuficiente",
      reviewId: ATTEMPT_ID,
    });
  });

  it("allows support to confirm and execute a full refund", async () => {
    dependencies.requirePermission.mockResolvedValue({
      role: "support",
      user: { id: "support-user" },
    });
    dependencies.issueRefundConfirmation.mockResolvedValue({
      confirmationToken: "single-use-token",
    });
    const confirmationForm = new FormData();
    confirmationForm.set("orderId", ATTEMPT_ID);
    confirmationForm.set("password", "current-password");

    await expect(
      confirmRefundPasswordAction(confirmationForm)
    ).resolves.toEqual({ confirmationToken: "single-use-token" });

    const refundForm = new FormData();
    refundForm.set("orderId", ATTEMPT_ID);
    refundForm.set("confirmationToken", "single-use-token");
    refundForm.set("typedOrderId", ATTEMPT_ID);
    refundForm.set("reason", "Solicitacao validada pelo suporte");
    await requestFullRefundAction(refundForm);

    expect(dependencies.requirePermission).toHaveBeenNthCalledWith(
      1,
      "executeRefund"
    );
    expect(dependencies.requirePermission).toHaveBeenNthCalledWith(
      2,
      "executeRefund"
    );
    expect(dependencies.issueRefundConfirmation).toHaveBeenCalledWith({
      actorUserId: "support-user",
      orderId: ATTEMPT_ID,
      password: "current-password",
    });
    expect(dependencies.requestFullRefund).toHaveBeenCalledWith({
      actorUserId: "support-user",
      confirmationToken: "single-use-token",
      orderId: ATTEMPT_ID,
      reason: "Solicitacao validada pelo suporte",
      typedOrderId: ATTEMPT_ID,
    });
  });

  it.each([
    {
      action: reconcileAsaasPaymentAction,
      form: { orderId: ATTEMPT_ID },
      provider: dependencies.reconcileAsaasPayment,
    },
    {
      action: importAsaasStatementAction,
      form: { finishDate: "2026-07-30", startDate: "2026-07-01" },
      provider: dependencies.importAsaasFinancialStatement,
    },
    {
      action: resolvePaymentReviewAction,
      form: { decision: "approved", reviewId: ATTEMPT_ID },
      provider: dependencies.resolvePaymentReview,
    },
    {
      action: retryFailedAsaasWebhookAction,
      form: { webhookEventId: ATTEMPT_ID },
      provider: dependencies.requeueFailedAsaasWebhook,
    },
  ])("denies support-only financial mutation before $action.name", async ({
    action,
    form,
    provider,
  }) => {
    dependencies.requirePermission.mockRejectedValue(
      new Error("permission_denied")
    );
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.set(key, value);
    }

    await expect(action(formData)).rejects.toThrow("permission_denied");
    expect(provider).not.toHaveBeenCalled();
  });
});
