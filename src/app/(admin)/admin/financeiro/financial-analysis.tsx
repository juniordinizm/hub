import { FinanceHelp } from "@/components/admin/finance-help";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminFinancialAnalytics } from "@/features/admin/server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { AdminMetricCard } from "../admin-metric-card";
import { FinancialPeriodSelect } from "./financial-period-select";

const formatPercent = (value: number | null): string =>
  value === null
    ? "Sem base"
    : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const formatCurrencyWithBase = (value: number, denominator: number): string =>
  denominator > 0 ? formatCurrencyInCents(value) : "Sem base";

export function FinancialAnalysis({
  analytics,
}: {
  analytics: AdminFinancialAnalytics;
}): React.JSX.Element {
  const hasReceivedOrders = analytics.paidOrders > 0;
  const averageReceivedTicket = formatCurrencyWithBase(
    analytics.averageReceivedTicketInCents,
    analytics.paidOrders
  );
  const refundRate = hasReceivedOrders
    ? formatPercent(analytics.refundRatePercent)
    : "Sem base";
  const feeHelper =
    analytics.missingFeeEvidenceOrders > 0
      ? `${analytics.missingFeeEvidenceOrders} pedido${analytics.missingFeeEvidenceOrders === 1 ? "" : "s"} sem taxa ou líquido completo; estimativa parcial.`
      : "Taxas identificadas nos snapshots de pagamento.";
  const netHelper =
    analytics.missingFeeEvidenceOrders > 0
      ? `Estimativa após taxas e reembolsos; ${analytics.missingFeeEvidenceOrders} pedido${analytics.missingFeeEvidenceOrders === 1 ? "" : "s"} sem evidência financeira completa.`
      : "Estimativa após taxas e reembolsos confirmados.";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <CardTitle as="h2" className="text-base">
                Análise por período
              </CardTitle>
              <FinanceHelp
                description="Consulte como cada indicador é calculado, quais dados entram e quais são os limites desta análise."
                details={[
                  "Cada Pedido com recebimento entra uma vez, inclusive quando a compra é parcelada; o valor total da compra não é dividido em parcelas.",
                  "Recebido confirmado soma o valor bruto dos Pedidos pagos, reembolsados ou em disputa com evidência de pagamento. A data usada é a confirmação do pagamento ou, se ausente, a criação do Pedido.",
                  "Valor médio recebido usa o valor total registrado para a compra, não uma parcela isolada.",
                  "Recebimentos em aberto consideram apenas Pedidos pendentes com checkout não encerrado e criados no período; parcelas futuras de uma cobrança já confirmada não entram.",
                  "Reembolsos usam a confirmação do evento; o líquido é uma estimativa baseada nos dados salvos no Hub e não substitui o fechamento contábil.",
                  "Os indicadores não representam o saldo disponível no Asaas. Para conciliação oficial, confira o Asaas e os detalhes da cobrança; cobranças individuais aparecem quando são sincronizadas.",
                ]}
                title="Análise por período"
              />
            </div>
            <CardDescription className="mt-1">
              <span className="block">
                {analytics.periodLabel}: compare desempenho, pendências e
                reembolsos.
              </span>
              <span className="block text-xs">
                Valores operacionais do Hub; não representam o saldo disponível
                no Asaas.
              </span>
            </CardDescription>
          </div>
          <FinancialPeriodSelect value={analytics.period} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-8">
        <section
          aria-labelledby="financial-analysis-summary-title"
          className="grid gap-3"
        >
          <div className="grid gap-1">
            <h3
              className="type-card-title"
              id="financial-analysis-summary-title"
            >
              Resumo financeiro
            </h3>
            <p className="type-body-sm text-muted-foreground">
              Totais do período, com o líquido apresentado como estimativa.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              helper={`${analytics.paidOrders} pedido${analytics.paidOrders === 1 ? "" : "s"} com evidência de pagamento; valor antes de taxas e reembolsos.`}
              label="Recebido confirmado"
              value={formatCurrencyInCents(analytics.grossReceivedInCents)}
            />
            <AdminMetricCard
              helper={feeHelper}
              label="Taxas identificadas"
              value={formatCurrencyInCents(analytics.feesInCents)}
            />
            <AdminMetricCard
              helper={`${analytics.refundedOrders} pedido${analytics.refundedOrders === 1 ? "" : "s"} com reembolso confirmado.`}
              label="Reembolsos confirmados"
              value={formatCurrencyInCents(analytics.refundedRevenueInCents)}
            />
            <AdminMetricCard
              helper={netHelper}
              label="Líquido estimado"
              value={formatCurrencyInCents(
                analytics.estimatedNetRevenueInCents
              )}
            />
          </div>
        </section>
        <section
          aria-labelledby="financial-analysis-operational-title"
          className="grid gap-3 border-t pt-6"
        >
          <div className="grid gap-1">
            <h3
              className="type-card-title"
              id="financial-analysis-operational-title"
            >
              Indicadores operacionais
            </h3>
            <p className="type-body-sm text-muted-foreground">
              Volume, média, pendências e proporção de reembolsos do período.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              helper="Pedidos com evidência de pagamento no período."
              label="Pedidos com recebimento"
              value={analytics.paidOrders.toString()}
            />
            <AdminMetricCard
              helper="Recebido bruto dividido pelos pedidos com recebimento."
              label="Valor médio recebido"
              value={averageReceivedTicket}
            />
            <AdminMetricCard
              helper={`${analytics.pendingOrders} pedido${analytics.pendingOrders === 1 ? "" : "s"} ainda sem confirmação, criados no período.`}
              label="Recebimentos em aberto"
              value={formatCurrencyInCents(analytics.pendingRevenueInCents)}
            />
            <AdminMetricCard
              helper="Indicador operacional: reembolsos confirmados no período divididos pelos recebimentos do período."
              label="Taxa de reembolso"
              value={refundRate}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
