import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/payments/actions", () => ({
  confirmRefundPasswordAction: vi.fn(),
  importAsaasStatementAction: vi.fn(),
  reconcileAsaasPaymentAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
  resolvePaymentReviewAction: vi.fn(),
  retryFailedAsaasWebhookAction: vi.fn(),
}));

import { FinancialOverview } from "./financial-overview";

describe("FinancialOverview", () => {
  it("keeps the review queue ahead of course revenue and identifies an empty page", () => {
    const markup = renderToStaticMarkup(
      <FinancialOverview
        canManageFinancialOperations={false}
        canManageFinancialReviews={false}
        canViewGlobalAudit={false}
        coursesRevenue={{ courses: [] }}
        financialHealth={{
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
        }}
        paymentReviews={{
          hasNextPage: false,
          history: [],
          historyTotalCount: 0,
          page: 2,
          pageSize: 20,
          reviews: [],
          totalCount: 1,
        }}
      />
    );

    expect(markup).toContain("Nenhuma revisão nesta página");
    expect(markup).not.toContain("Tudo em ordem");
    expect(markup).not.toContain("Receita sem alerta");
    expect(markup).not.toContain("Integração Asaas sem falhas");
    expect(markup).toContain("Anteriores");
    expect(markup.indexOf("Pendências financeiras")).toBeLessThan(
      markup.indexOf("Receita por curso")
    );
    expect(markup.indexOf("Pendências financeiras")).toBeLessThan(
      markup.indexOf("Receita bruta de pedidos pagos")
    );
  });
});
