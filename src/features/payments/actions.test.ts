import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  importAsaasFinancialStatement: vi.fn(),
  reconcileAsaasPayment: vi.fn(),
  requirePermission: vi.fn(),
  resolvePaymentReview: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/payments/refunds", () => ({
  issueRefundConfirmation: vi.fn(),
  requestFullRefund: vi.fn(),
}));
vi.mock("@/features/payments/reconciliation", () => ({
  importAsaasFinancialStatement: dependencies.importAsaasFinancialStatement,
  reconcileAsaasPayment: dependencies.reconcileAsaasPayment,
}));
vi.mock("@/features/payments/asaas-webhook-worker", () => ({
  requeueFailedAsaasWebhook: vi.fn(),
}));
vi.mock("@/features/payments/payment-reviews", () => ({
  resolvePaymentReview: dependencies.resolvePaymentReview,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import {
  importAsaasStatementAction,
  reconcileAsaasPaymentAction,
  resolvePaymentReviewAction,
} from "./actions";

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";

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
});
