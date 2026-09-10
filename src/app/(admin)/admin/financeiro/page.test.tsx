import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  importAsaasStatementAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
  resolvePaymentReviewAction: vi.fn(),
  retryFailedAsaasWebhookAction: vi.fn(),
}));

const pageDependencies = vi.hoisted(() => ({
  getAdminFinancialAnalysisData: vi.fn(),
  getAdminFinancialOrdersData: vi.fn(),
  getAdminFinancialOverviewData: vi.fn(),
  getAdminStatementImportHistory: vi.fn(),
  getAdminStatementImportProgress: vi.fn(),
}));
const authDependencies = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));
const navigationState = vi.hoisted(() => ({ search: "" }));

vi.mock("@/features/admin/server", () => pageDependencies);
vi.mock("@/lib/auth-permissions", () => authDependencies);

import { CoursesRevenueTable } from "./courses-revenue-table";
import { getReviewOrderHref } from "./financial-operations-shared";
import {
  PaymentReviewHistorySheet,
  PaymentReviewOperation,
} from "./financial-payment-review";
import { FinancialOperationsMenu } from "./financial-statement-import";
import AdminFinancePage from "./page";

const paidOrderId = "order-1";

const paymentReview = {
  amountInCents: 12_990,
  courseTitle: "Curso",
  createdAt: new Date("2026-09-08T12:00:00.000Z"),
  customerEmail: "student@example.com",
  customerName: "Student",
  id: "review-1",
  orderId: "order-1",
  orderStatus: "pending",
  observedAmountInCents: 12_000,
  paidAmountInCents: 12_000,
  providerCheckoutId: "chk-1",
  providerPaymentId: "pay-1",
  providerPaymentStatus: "RECEIVED",
  reason: "paid amount differs from offer snapshot",
  status: "pending",
  type: "amount_mismatch",
} as const;

describe("FinancialOperationsMenu", () => {
  it("renders the compact financial actions trigger", () => {
    const markup = renderToStaticMarkup(
      <FinancialOperationsMenu
        statementImportHistory={[]}
        statementImportProgress={null}
      />
    );

    expect(markup).toContain("Ações financeiras");
  });

  it("deep-links review order references to the orders tab", () => {
    expect(getReviewOrderHref("order-1")).toBe(
      "/admin/financeiro?tab=orders&q=order-1"
    );
  });
});

describe("CoursesRevenueTable", () => {
  it("renders course revenue without a course counter or filter", () => {
    const markup = renderToStaticMarkup(
      <CoursesRevenueTable
        data={[
          {
            courseId: "course-1",
            courseTitle: "Curso",
            paidOrders: 2,
            totalOrders: 3,
            totalRevenueInCents: 25_000,
          },
        ]}
      />
    );

    expect(markup).not.toContain("2–2 de 3 cursos");
    expect(markup).not.toContain("1–3 de 3 cursos");
    expect(markup).toContain("Receita bruta paga");
    expect(markup).not.toContain("Buscar receita por curso");
    expect(markup).not.toContain("revenueQ");
    expect(markup.match(/overflow-x-auto/g)).toHaveLength(1);
  });
});

describe("PaymentReviewOperation", () => {
  it("hides amount mismatch decisions without mutable review access", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations={false}
        canManageFinancialReviews={false}
        review={paymentReview}
      />
    );

    expect(markup).not.toContain("Liberar e aceitar divergência");
    expect(markup).not.toContain("Manter acesso bloqueado");
    expect(markup).toContain("Aguardando decisão de uma administradora.");
  });

  it("shows the amount context before allowing a mismatch decision", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations={false}
        canManageFinancialReviews
        review={paymentReview}
      />
    );

    expect(markup).toContain("Snapshot do Pedido");
    expect(markup).toContain("129,90");
    expect(markup).toContain("Valor observado");
    expect(markup).toContain("120,00");
    expect(markup).toContain("Confirme os valores acima antes de decidir.");
    expect(markup).toContain("Registrar decisão");
    expect(markup).toContain(
      "O valor observado no Asaas não corresponde ao valor registrado no Pedido."
    );
    expect(markup).toContain("Evidência técnica");
    expect(markup).toContain("paid amount differs from offer snapshot");
    expect(markup.split("Evidência técnica")[0]).not.toContain(
      "paid amount differs from offer snapshot"
    );
  });

  it("renders one refund flow when a pending buyer identity review has no order card", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations={false}
        canManageFinancialReviews
        review={{
          ...paymentReview,
          reason: "buyer_identity_team_account",
          type: "buyer_identity",
        }}
      />
    );

    expect(markup).toContain("Identidade da compra requer suporte");
    expect(markup).toContain(
      "Nenhum acesso é liberado enquanto a revisão de identidade estiver pendente."
    );
    expect(markup.split("Solicitar reembolso integral")).toHaveLength(2);
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup.match(/name="orderId"/g)).toHaveLength(1);
    expect(markup.match(/id="refund-password-order-1"/g)).toHaveLength(1);
    expect(markup).not.toContain("Aprovar");
    expect(markup).not.toContain("Rejeitar");
  });

  it("renders one refund flow for a pending buyer identity review", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations={false}
        canManageFinancialReviews
        review={{
          ...paymentReview,
          orderId: paidOrderId,
          reason: "buyer_identity_team_account",
          type: "buyer_identity",
        }}
      />
    );

    expect(markup.split("Solicitar reembolso integral")).toHaveLength(2);
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup.match(/name="orderId"/g)).toHaveLength(1);
    expect(markup.match(/id="refund-password-order-1"/g)).toHaveLength(1);
  });

  it("keeps resolved buyer identity reviews as history without another refund operation", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations={false}
        canManageFinancialReviews
        review={{
          ...paymentReview,
          orderStatus: "refunded",
          reason: "buyer_identity_team_account",
          status: "rejected",
          type: "buyer_identity",
        }}
      />
    );

    expect(markup).toContain("Identidade da compra requer suporte");
    expect(markup).toContain("Revisão rejeitada.");
    expect(markup).not.toContain("Solicitar estorno integral");
  });

  it("offers contextual reconciliation instead of a generic decision", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewOperation
        canManageFinancialOperations
        canManageFinancialReviews
        review={{
          ...paymentReview,
          reason: "terminal state conflict",
          type: "terminal_conflict",
        }}
      />
    );

    expect(markup).toContain("Conciliar pagamento");
    expect(markup).toContain('name="reviewId" value="review-1"');
    expect(markup).not.toContain("Registrar decisão");
  });
});

describe("PaymentReviewHistorySheet", () => {
  it("keeps review history available beside the pending queue", () => {
    const markup = renderToStaticMarkup(
      <PaymentReviewHistorySheet
        history={[
          {
            ...paymentReview,
            decisionReason: "Valor conferido.",
            orderStatus: "paid",
            resolvedAt: new Date("2026-09-08T13:00:00.000Z"),
            resolvedByEmail: "admin@example.com",
            status: "approved",
          },
        ]}
        totalCount={1}
      />
    );

    expect(markup).toContain("Histórico (1)");
  });
});

describe("AdminFinancePage", () => {
  const financialHealth = {
    abandonedCheckoutOrders: 0,
    averagePaidTicketInCents: 10_000,
    checkoutConversionPercent: 50,
    disputedOrders: 0,
    failedWebhooks: 0,
    paidOrders: 1,
    paidRevenueInCents: 10_000,
    pendingOrders: 0,
    pendingRevenueInCents: 0,
    readyWebhooks: 0,
    refundedOrders: 0,
    retryableWebhooks: 0,
    totalOrders: 2,
  };

  beforeEach(() => {
    navigationState.search = "";
    authDependencies.requirePermission.mockReset();
    authDependencies.requirePermission.mockResolvedValue({ role: "admin" });
    pageDependencies.getAdminFinancialOrdersData.mockReset();
    pageDependencies.getAdminFinancialAnalysisData.mockReset();
    pageDependencies.getAdminFinancialOverviewData.mockReset();
    pageDependencies.getAdminStatementImportHistory.mockReset();
    pageDependencies.getAdminStatementImportProgress.mockReset();
    pageDependencies.getAdminStatementImportHistory.mockResolvedValue([]);
    pageDependencies.getAdminStatementImportProgress.mockResolvedValue(null);
  });

  it("loads only overview data for the default tab", async () => {
    pageDependencies.getAdminFinancialOverviewData.mockResolvedValue({
      coursesRevenue: {
        courses: [],
      },
      financialHealth,
      paymentReviews: {
        hasNextPage: false,
        history: [],
        historyTotalCount: 0,
        page: 1,
        pageSize: 20,
        reviews: [],
        totalCount: 0,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminFinancePage({ searchParams: Promise.resolve({}) })
    );

    expect(
      pageDependencies.getAdminFinancialOverviewData
    ).toHaveBeenCalledOnce();
    expect(pageDependencies.getAdminFinancialOrdersData).not.toHaveBeenCalled();
    expect(markup).toContain("Visão geral");
    expect(markup).not.toContain("Receita sem alerta");
    expect(markup).toContain("Pagos");
    expect(markup).toContain("Tudo em ordem");
    expect(markup).not.toContain("Busque, filtre e abra um pedido");
  });

  it("loads only orders data when the orders tab is deep-linked", async () => {
    navigationState.search = "tab=orders";
    pageDependencies.getAdminFinancialOrdersData.mockResolvedValue({
      orders: [],
      ordersHasNextPage: false,
      ordersTotalCount: 0,
    });

    const markup = renderToStaticMarkup(
      await AdminFinancePage({
        searchParams: Promise.resolve({ tab: "orders" }),
      })
    );

    expect(pageDependencies.getAdminFinancialOrdersData).toHaveBeenCalledOnce();
    expect(
      pageDependencies.getAdminFinancialOverviewData
    ).not.toHaveBeenCalled();
    expect(markup).toContain("Busque, filtre e abra um pedido");
  });

  it("loads only analysis data for the analysis tab", async () => {
    navigationState.search = "tab=analysis&period=30d";
    pageDependencies.getAdminFinancialAnalysisData.mockResolvedValue({
      analytics: {
        averageReceivedTicketInCents: 5000,
        estimatedNetRevenueInCents: 9000,
        feesInCents: 500,
        grossReceivedInCents: 10_000,
        missingFeeEvidenceOrders: 0,
        paidOrders: 2,
        pendingOrders: 3,
        pendingRevenueInCents: 15_000,
        period: "30d",
        periodLabel: "Últimos 30 dias",
        refundRatePercent: 50,
        refundedOrders: 1,
        refundedRevenueInCents: 500,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminFinancePage({
        searchParams: Promise.resolve({ period: "30d", tab: "analysis" }),
      })
    );

    expect(pageDependencies.getAdminFinancialAnalysisData).toHaveBeenCalledWith(
      "30d"
    );
    expect(
      pageDependencies.getAdminFinancialOverviewData
    ).not.toHaveBeenCalled();
    expect(pageDependencies.getAdminFinancialOrdersData).not.toHaveBeenCalled();
    expect(markup).toContain("Análise por período");
  });
});
