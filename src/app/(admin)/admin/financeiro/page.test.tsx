import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  importAsaasStatementAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
  resolvePaymentReviewAction: vi.fn(),
  retryFailedAsaasWebhookAction: vi.fn(),
}));

import { PaymentReviewOperation } from "./financial-operations";
import { FinancialOrderCard, FinancialStatementImportCard } from "./page";

const paidOrder = {
  amountInCents: 12_990,
  checkoutStatus: "active",
  courseId: "course-1",
  courseTitle: "Curso",
  customerEmail: "student@example.com",
  customerName: "Student",
  feeAmountInCents: 390,
  id: "order-1",
  netAmountInCents: 12_600,
  paidAmountInCents: 12_990,
  paidAt: new Date("2026-07-30T12:00:00.000Z"),
  paymentMethod: "PIX",
  providerCheckoutId: "chk-1",
  providerPaymentId: "pay-1",
  providerPaymentStatus: "RECEIVED",
  refundRequestStatus: null,
  status: "paid",
} as const;

describe("FinancialOrderCard", () => {
  it("keeps refund available but hides reconciliation without mutable financial access", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrderCard
        canManageFinancialOperations={false}
        hasPendingBuyerIdentityReview={false}
        order={paidOrder}
      />
    );

    expect(markup).toContain("Solicitar estorno integral");
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup.match(/name="orderId"/g)).toHaveLength(1);
    expect(markup.match(/id="refund-password-order-1"/g)).toHaveLength(1);
    expect(markup).not.toContain("Conciliar pagamento");
  });

  it("shows reconciliation with mutable financial access", () => {
    const markup = renderToStaticMarkup(
      <FinancialOrderCard
        canManageFinancialOperations
        hasPendingBuyerIdentityReview={false}
        order={paidOrder}
      />
    );

    expect(markup).toContain("Conciliar pagamento");
  });
});

describe("FinancialStatementImportCard", () => {
  it("hides statement import without mutable financial access", () => {
    const markup = renderToStaticMarkup(
      <FinancialStatementImportCard canManageFinancialOperations={false} />
    );

    expect(markup).not.toContain("Importar extrato");
  });

  it("shows statement import with mutable financial access", () => {
    const markup = renderToStaticMarkup(
      <FinancialStatementImportCard canManageFinancialOperations />
    );

    expect(markup).toContain("Importar extrato");
  });
});

describe("PaymentReviewOperation", () => {
  it("hides amount mismatch decisions without mutable review access", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialReviews={false}
        review={{
          id: "review-1",
          orderId: "order-1",
          providerCheckoutId: "chk-1",
          reason: "paid amount differs from offer snapshot",
          status: "pending",
          type: "amount_mismatch",
        }}
      />
    );

    expect(markup).not.toContain("Aprovar");
    expect(markup).not.toContain("Rejeitar");
    expect(markup).toContain("Aguardando decisao de uma administradora.");
  });

  it("renders one refund flow when a pending buyer identity review has no order card", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialReviews
        review={{
          id: "review-1",
          orderId: "order-1",
          providerCheckoutId: "chk-1",
          reason: "buyer_identity_team_account",
          status: "pending",
          type: "buyer_identity",
        }}
      />
    );

    expect(markup).toContain("Identidade da compra requer suporte");
    expect(markup).toContain(
      "Não libere ou transfira o acesso. Execute o reembolso integral."
    );
    expect(markup.split("Solicitar estorno integral")).toHaveLength(2);
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup.match(/name="orderId"/g)).toHaveLength(1);
    expect(markup.match(/id="refund-password-order-1"/g)).toHaveLength(1);
    expect(markup).not.toContain("Aprovar");
    expect(markup).not.toContain("Rejeitar");
  });

  it("renders one refund flow for a paid order with a pending buyer identity review", () => {
    const markup = renderToStaticMarkup(
      <>
        <FinancialOrderCard
          canManageFinancialOperations={false}
          hasPendingBuyerIdentityReview
          order={paidOrder}
        />
        <PaymentReviewOperation
          canManageFinancialReviews
          review={{
            id: "review-1",
            orderId: paidOrder.id,
            providerCheckoutId: paidOrder.providerCheckoutId,
            reason: "buyer_identity_team_account",
            status: "pending",
            type: "buyer_identity",
          }}
        />
      </>
    );

    expect(markup.split("Solicitar estorno integral")).toHaveLength(2);
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup.match(/name="orderId"/g)).toHaveLength(1);
    expect(markup.match(/id="refund-password-order-1"/g)).toHaveLength(1);
  });

  it("keeps resolved buyer identity reviews as history without another refund operation", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialReviews
        review={{
          id: "review-1",
          orderId: "order-1",
          providerCheckoutId: "chk-1",
          reason: "buyer_identity_team_account",
          status: "rejected",
          type: "buyer_identity",
        }}
      />
    );

    expect(markup).toContain("Identidade da compra requer suporte");
    expect(markup).toContain("Revisao rejected.");
    expect(markup).not.toContain("Solicitar estorno integral");
  });
});
