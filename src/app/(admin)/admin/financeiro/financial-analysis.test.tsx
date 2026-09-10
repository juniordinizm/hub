import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { FinancialAnalysis } from "./financial-analysis";

describe("FinancialAnalysis", () => {
  it("explains the period metrics and keeps the estimate explicit", () => {
    const markup = renderToStaticMarkup(
      <FinancialAnalysis
        analytics={{
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
        }}
      />
    );

    expect(markup).toContain("Análise por período");
    expect(markup).toContain("Recebido confirmado");
    expect(markup).toContain("Líquido estimado");
    expect(markup).toContain("Pedidos com recebimento");
    expect(markup).toContain("Valor médio recebido");
    expect(markup).toContain("Recebimentos em aberto");
    expect(markup).not.toContain("Taxas sobre recebimentos");
    expect(markup).toContain("Taxa de reembolso");
    expect(markup).toContain("150,00");
    expect(markup).toContain("Últimos 30 dias");
    expect(markup).toContain("Ajuda: Análise por período");
    expect(markup).toContain("Valores operacionais do Hub");
    expect(markup).not.toContain("Como interpretar esta análise");
    expect(markup).not.toContain("ainda não sincroniza o calendário");
  });

  it("shows Sem base when the period has no received orders", () => {
    const markup = renderToStaticMarkup(
      <FinancialAnalysis
        analytics={{
          averageReceivedTicketInCents: 0,
          estimatedNetRevenueInCents: 0,
          feesInCents: 0,
          grossReceivedInCents: 0,
          missingFeeEvidenceOrders: 0,
          paidOrders: 0,
          pendingOrders: 0,
          pendingRevenueInCents: 0,
          period: "all",
          periodLabel: "Todo o histórico",
          refundRatePercent: null,
          refundedOrders: 0,
          refundedRevenueInCents: 0,
        }}
      />
    );

    expect(markup.match(/>Sem base</g)).toHaveLength(2);
    expect(markup).toContain("Resumo financeiro");
    expect(markup).toContain("Indicadores operacionais");
  });
});
