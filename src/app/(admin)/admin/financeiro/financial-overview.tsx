import {
  Alert02Icon,
  Analytics01Icon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  CreditCardIcon,
  Invoice01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type {
  AdminOrderCheckoutFilter,
  AdminOrderStatusFilter,
} from "@/features/admin/order-filters";
import type { AdminFinancialHealthSummary } from "@/features/admin/presentation";
import type {
  AdminCourseRevenueData,
  AdminPaymentReviewPage,
} from "@/features/admin/server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { AdminMetricCard } from "../admin-metric-card";
import { CoursesRevenueTable } from "./courses-revenue-table";
import {
  PaymentReviewHistorySheet,
  PaymentReviewOperation,
} from "./financial-payment-review";

const getOrdersHref = ({
  checkout,
  status,
}: {
  checkout?: AdminOrderCheckoutFilter;
  status: AdminOrderStatusFilter;
}): string => {
  const params = new URLSearchParams();
  params.set("tab", "orders");
  params.set("status", status);
  if (checkout) {
    params.set("checkout", checkout);
  }
  const query = params.toString();
  return query ? `/admin/financeiro?${query}` : "/admin/financeiro";
};

const getReviewPageHref = (page: number): string =>
  page > 1 ? `/admin/financeiro?reviewPage=${page}` : "/admin/financeiro";

interface PaymentReviewsSectionProps {
  canManageFinancialOperations: boolean;
  canManageFinancialReviews: boolean;
  paymentReviews: AdminPaymentReviewPage;
}

function PaymentReviewContent({
  canManageFinancialOperations,
  canManageFinancialReviews,
  paymentReviews,
}: Pick<
  PaymentReviewsSectionProps,
  | "canManageFinancialOperations"
  | "canManageFinancialReviews"
  | "paymentReviews"
>): React.JSX.Element {
  if (paymentReviews.reviews.length > 0) {
    return (
      <>
        {paymentReviews.reviews.map((review) => (
          <PaymentReviewOperation
            canManageFinancialOperations={canManageFinancialOperations}
            canManageFinancialReviews={canManageFinancialReviews}
            key={review.id}
            review={review}
          />
        ))}
      </>
    );
  }

  if (paymentReviews.totalCount === 0) {
    return (
      <Empty className="rounded-lg border border-dashed py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} />
          </EmptyMedia>
          <EmptyTitle as="h3">Tudo em ordem</EmptyTitle>
          <EmptyDescription>
            Nenhuma revisão financeira aguarda decisão ou evidência.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="rounded-lg border border-dashed py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon aria-hidden="true" icon={Alert02Icon} />
        </EmptyMedia>
        <EmptyTitle as="h3">Nenhuma revisão nesta página</EmptyTitle>
        <EmptyDescription>
          Há{" "}
          {paymentReviews.totalCount === 1
            ? "1 revisão pendente"
            : `${paymentReviews.totalCount} revisões pendentes`}{" "}
          no total. Use Anteriores para voltar a uma página com itens.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function PaymentReviewsSection({
  canManageFinancialOperations,
  canManageFinancialReviews,
  paymentReviews,
}: PaymentReviewsSectionProps): React.JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle as="h2" className="text-base">
                Pendências financeiras
              </CardTitle>
              <FinanceHelp
                description="Consulte os critérios e os próximos passos para tratar cada pendência."
                details={[
                  "Leia o motivo e os estados do Pedido antes de agir.",
                  "Conciliação e reembolso são operações específicas; não aprove uma divergência sem conferir a evidência.",
                ]}
                title="Pendências financeiras"
              />
              {paymentReviews.totalCount > 0 ? (
                <Badge variant="destructive">{paymentReviews.totalCount}</Badge>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              Resolva exceções antes de liberar acesso ou encerrar um Pedido.
            </CardDescription>
          </div>
          <PaymentReviewHistorySheet
            history={paymentReviews.history}
            totalCount={paymentReviews.historyTotalCount}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <PaymentReviewContent
          canManageFinancialOperations={canManageFinancialOperations}
          canManageFinancialReviews={canManageFinancialReviews}
          paymentReviews={paymentReviews}
        />
        {paymentReviews.page > 1 || paymentReviews.hasNextPage ? (
          <div>
            <Separator />
            <nav
              aria-label="Paginação de revisões financeiras"
              className="flex items-center justify-between gap-3 pt-3"
            >
              {paymentReviews.page > 1 ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={getReviewPageHref(paymentReviews.page - 1)}
                >
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              {paymentReviews.hasNextPage ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={getReviewPageHref(paymentReviews.page + 1)}
                >
                  Próximas
                </Link>
              ) : null}
            </nav>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FinancialOverview({
  canManageFinancialOperations,
  canManageFinancialReviews,
  canViewGlobalAudit,
  coursesRevenue,
  financialHealth,
  paymentReviews,
}: {
  canManageFinancialOperations: boolean;
  canManageFinancialReviews: boolean;
  canViewGlobalAudit: boolean;
  coursesRevenue: AdminCourseRevenueData;
  financialHealth: AdminFinancialHealthSummary;
  paymentReviews: AdminPaymentReviewPage;
}): React.JSX.Element {
  const failedWebhooks = financialHealth.failedWebhooks;
  const retryableWebhooks = financialHealth.retryableWebhooks;
  const hasIntegrationNotice =
    failedWebhooks > 0 ||
    retryableWebhooks > 0 ||
    financialHealth.readyWebhooks > 0;
  const averagePaidTicket =
    financialHealth.paidOrders > 0
      ? formatCurrencyInCents(financialHealth.averagePaidTicketInCents)
      : "Sem base";
  const averagePaidTicketHelper =
    financialHealth.paidOrders > 0
      ? "Receita dos pedidos atualmente pagos dividida pela quantidade de pedidos."
      : "Sem base: ainda não há pedidos atualmente pagos.";
  const checkoutConversion =
    financialHealth.totalOrders > 0
      ? `${financialHealth.checkoutConversionPercent}%`
      : "Sem base";
  const checkoutConversionHelper =
    financialHealth.totalOrders > 0
      ? "Pedidos pagos divididos por pedidos registrados no histórico."
      : "Sem base: ainda não há pedidos registrados no histórico.";
  const hasPendingReviews = paymentReviews.totalCount > 0;
  const paymentReviewsSection = (
    <PaymentReviewsSection
      canManageFinancialOperations={canManageFinancialOperations}
      canManageFinancialReviews={canManageFinancialReviews}
      paymentReviews={paymentReviews}
    />
  );

  return (
    <>
      {hasPendingReviews ? (
        <section aria-label="Ações financeiras pendentes">
          {paymentReviewsSection}
        </section>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          helper={`${financialHealth.paidOrders} pedido${
            financialHealth.paidOrders === 1 ? "" : "s"
          } pago${financialHealth.paidOrders === 1 ? "" : "s"} no histórico completo.`}
          icon={Coins01Icon}
          label="Receita bruta de pedidos pagos"
          value={formatCurrencyInCents(financialHealth.paidRevenueInCents)}
        />
        <AdminMetricCard
          helper={averagePaidTicketHelper}
          icon={CreditCardIcon}
          label="Valor médio dos pedidos pagos"
          value={averagePaidTicket}
        />
        <AdminMetricCard
          help={
            <FinanceHelp
              description="Valor dos pedidos que ainda aguardam confirmação de pagamento."
              details={[
                "Checkouts falhos, cancelados ou expirados ficam fora deste valor.",
                "Use a aba Pedidos para consultar cada caso e a evidência disponível.",
              ]}
              title="Valor em aberto"
            />
          }
          helper={`${financialHealth.pendingOrders} pedido${
            financialHealth.pendingOrders === 1 ? "" : "s"
          } em aberto no histórico.`}
          icon={Alert02Icon}
          label="Valor em aberto"
          value={formatCurrencyInCents(financialHealth.pendingRevenueInCents)}
        />
        <AdminMetricCard
          help={
            <FinanceHelp
              description="Percentual de pedidos pagos em relação a todos os pedidos registrados."
              details={[
                "É um indicador operacional de pedidos, não uma conversão de visitantes do checkout.",
                "Pedidos cancelados e checkouts encerrados permanecem no denominador.",
              ]}
              title="Pedidos pagos / registrados"
            />
          }
          helper={checkoutConversionHelper}
          icon={ShoppingCart01Icon}
          label="Pedidos pagos / registrados"
          value={checkoutConversion}
        />
      </section>

      <section>
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <CardTitle as="h2" className="text-base">
                    Saúde financeira
                  </CardTitle>
                  <FinanceHelp
                    description="Consulte como ler os estados do Pedido e os alertas da integração."
                    details={[
                      "Pendentes aguardam pagamento; Pagos têm recebimento confirmado; Disputas e Reembolsos exigem leitura do caso.",
                      "Checkouts encerrados sem pagamento aparecem como observação e não entram no valor em aberto.",
                      "Webhooks são avisos automáticos do Asaas; falhas e retries podem atrasar a atualização local.",
                    ]}
                    title="Saúde financeira"
                  />
                </div>
                <CardDescription className="mt-1">
                  Quatro estados dos Pedidos; alertas da integração aparecem
                  quando necessário.
                </CardDescription>
              </div>
              <div className="flex size-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Invoice01Icon}
                  size={18}
                  strokeWidth={2}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <FinanceStatusTile
                  href={getOrdersHref({
                    checkout: "open",
                    status: "pending",
                  })}
                  label="Pendentes"
                  value={financialHealth.pendingOrders.toString()}
                />
                <FinanceStatusTile
                  href={getOrdersHref({ status: "paid" })}
                  label="Pagos"
                  value={financialHealth.paidOrders.toString()}
                />
                <FinanceStatusTile
                  href={getOrdersHref({ status: "disputed" })}
                  label="Disputas"
                  value={financialHealth.disputedOrders.toString()}
                />
                <FinanceStatusTile
                  href={getOrdersHref({ status: "refunded" })}
                  label="Reembolsos"
                  value={financialHealth.refundedOrders.toString()}
                />
              </div>
            </div>
            {financialHealth.abandonedCheckoutOrders > 0 ? (
              <p className="px-5 py-3 text-muted-foreground text-xs">
                {financialHealth.abandonedCheckoutOrders} checkout
                {financialHealth.abandonedCheckoutOrders === 1 ? "" : "s"}{" "}
                encerrado
                {financialHealth.abandonedCheckoutOrders === 1 ? "" : "s"}
                sem pagamento. Eles não entram no valor em aberto.{" "}
                <Link
                  className="font-medium underline underline-offset-4"
                  href={getOrdersHref({
                    checkout: "closed",
                    status: "pending",
                  })}
                >
                  Ver checkouts encerrados
                </Link>
              </p>
            ) : null}
            {hasIntegrationNotice ? (
              <>
                <Separator />
                <div className="bg-muted/10 p-5">
                  <FinancialIntegrationStatus
                    canViewGlobalAudit={canViewGlobalAudit}
                    failedWebhooks={failedWebhooks}
                    readyWebhooks={financialHealth.readyWebhooks}
                    retryableWebhooks={retryableWebhooks}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-8 xl:grid-cols-2">
        {hasPendingReviews ? null : paymentReviewsSection}
        <Card
          className={hasPendingReviews ? "min-w-0 xl:col-span-2" : "min-w-0"}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Analytics01Icon}
                size={18}
                strokeWidth={2}
              />
              <CardTitle as="h2" className="font-medium text-base">
                Receita por curso
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              Pedidos pagos e receita bruta por curso no histórico completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoursesRevenueTable data={coursesRevenue.courses} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

const getRetryDescription = (retryableWebhooks: number): string =>
  retryableWebhooks === 1
    ? "1 webhook também está em retry."
    : `${retryableWebhooks} webhooks também estão em retry.`;

function FinancialIntegrationStatus({
  canViewGlobalAudit,
  failedWebhooks,
  readyWebhooks,
  retryableWebhooks,
}: {
  canViewGlobalAudit: boolean;
  failedWebhooks: number;
  readyWebhooks: number;
  retryableWebhooks: number;
}): React.JSX.Element | null {
  if (failedWebhooks > 0) {
    return (
      <Alert role="alert" variant="destructive">
        <AlertTitle>
          {failedWebhooks} webhook{failedWebhooks === 1 ? "" : "s"} falho
          {failedWebhooks === 1 ? "" : "s"}
        </AlertTitle>
        <AlertDescription>
          {retryableWebhooks > 0
            ? getRetryDescription(retryableWebhooks)
            : "A atualização de pagamento ou acesso pode estar atrasada."}
          {canViewGlobalAudit ? (
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link href={route("/admin/auditoria")}>Abrir Auditoria</Link>
            </Button>
          ) : (
            <span className="mt-3 block text-destructive/80 text-xs">
              Encaminhe a recuperação para uma administradora.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (retryableWebhooks > 0) {
    return (
      <Alert role="status" variant="warning">
        <AlertTitle>Integração Asaas em nova tentativa</AlertTitle>
        <AlertDescription>
          {retryableWebhooks === 1
            ? "1 webhook está aguardando uma nova tentativa automática."
            : `${retryableWebhooks} webhooks estão aguardando novas tentativas automáticas.`}
          {canViewGlobalAudit ? (
            <Button asChild className="mt-3" size="sm" variant="outline">
              <Link href={route("/admin/auditoria")}>Abrir Auditoria</Link>
            </Button>
          ) : (
            <span className="mt-3 block text-muted-foreground text-xs">
              A recuperação será acompanhada por uma administradora.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (readyWebhooks > 0) {
    return (
      <Alert role="status" variant="info">
        <AlertTitle>Integração Asaas em processamento</AlertTitle>
        <AlertDescription>
          {readyWebhooks === 1
            ? "1 webhook recebido ainda está sendo processado."
            : `${readyWebhooks} webhooks recebidos ainda estão sendo processados.`}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function FinanceStatusTile({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <Link
      className="group flex h-full min-h-[126px] flex-col rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/50 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      href={href}
    >
      <p className="font-medium text-muted-foreground text-sm tracking-tight">
        {label}
      </p>
      <p className="mt-2 font-bold text-2xl tabular-nums tracking-tight">
        {value}
      </p>
      <span className="mt-1 text-muted-foreground text-xs underline-offset-4 group-hover:underline">
        Ver pedidos
      </span>
    </Link>
  );
}
