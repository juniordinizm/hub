import {
  Alert02Icon,
  Analytics01Icon,
  Certificate01Icon,
  Coins01Icon,
  CreditCardIcon,
  Invoice01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getAdminFinancialSignal,
  summarizeAdminFinancialHealth,
} from "@/features/admin/presentation";
import {
  type AdminOrder,
  getAdminFinancialData,
  getAdminOverview,
} from "@/features/admin/server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { AdminMetricCard } from "../admin-metric-card";
import { CoursesRevenueTable } from "./courses-revenue-table";
import {
  ImportStatementOperation,
  PaymentReviewOperation,
  ReconcilePaymentOperation,
  RefundOperation,
  RetryWebhookOperation,
} from "./financial-operations";

export const dynamic = "force-dynamic";

const orderStatusLabels: Record<string, string> = {
  cancelled: "Cancelado",
  disputed: "Em disputa",
  paid: "Pago",
  pending: "Pendente",
  refunded: "Reembolsado",
};

const webhookStatusLabels: Record<string, string> = {
  failed: "Falha",
  ignored: "Ignorado",
  processed: "Processado",
  received: "Recebido",
};

const readSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const financialPageHref = ({
  page,
  search,
}: {
  page: number;
  search: string;
}): string => {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/financeiro?${query}` : "/admin/financeiro";
};

interface FinancialSearchParams {
  page?: string | string[] | undefined;
  q?: string | string[] | undefined;
}

const getOrderQuery = (
  searchParams: FinancialSearchParams
): { page: number; search: string } => {
  const search = readSearchParameter(searchParams.q).trim();
  const requestedPage = Number.parseInt(
    readSearchParameter(searchParams.page),
    10
  );
  return {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    search,
  };
};

function FinancialOrderCard({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-medium text-sm">
          {order.customerName ?? order.customerEmail ?? "Aluno"}
        </p>
        <Badge className="shrink-0" variant="secondary">
          {orderStatusLabels[order.status] ?? order.status}
        </Badge>
      </div>
      <p className="mt-1 truncate text-muted-foreground text-xs">
        {order.courseTitle}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sm">
          Bruto:{" "}
          {formatCurrencyInCents(
            order.paidAmountInCents ?? order.amountInCents
          )}
        </span>
        {order.netAmountInCents === null ? null : (
          <span>Líquido: {formatCurrencyInCents(order.netAmountInCents)}</span>
        )}
        {order.feeAmountInCents === null ? null : (
          <span>Tarifa: {formatCurrencyInCents(order.feeAmountInCents)}</span>
        )}
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          checkout {order.providerCheckoutId ?? "pendente"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          pagamento {order.providerPaymentId ?? "não correlacionado"}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        {order.paymentMethod ?? "Método pendente"} · checkout{" "}
        {order.checkoutStatus} · pagamento{" "}
        {order.providerPaymentStatus ?? "pendente"}
        {order.refundRequestStatus
          ? ` · reembolso ${order.refundRequestStatus}`
          : ""}
      </p>
      {order.status === "paid" ? <RefundOperation orderId={order.id} /> : null}
      {order.providerPaymentId ? (
        <ReconcilePaymentOperation orderId={order.id} />
      ) : null}
    </div>
  );
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<FinancialSearchParams>;
}): Promise<React.JSX.Element> {
  const session = await requirePermission("viewFinancials");
  const resolvedSearchParams = await searchParams;
  const { page: orderPage, search: orderSearch } =
    getOrderQuery(resolvedSearchParams);

  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminFinancialData({ page: orderPage, search: orderSearch }),
  ]);
  const financialHealth = summarizeAdminFinancialHealth(data.orders);
  const financialSignal = getAdminFinancialSignal(financialHealth);
  const recentOrders = data.orders;
  const recentCertificates = data.certificates.slice(0, 6);
  const failedWebhooks = overview.recentWebhooks.filter(
    (event) => event.status === "failed"
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Receita e liberação de acesso
              </h1>
              <p className="text-muted-foreground text-sm">
                Acompanhe checkouts, pagamentos confirmados, disputas, webhooks
                e certificados emitidos.
              </p>
            </div>
            <Badge
              className="shrink-0"
              variant={
                financialSignal.tone === "attention"
                  ? "destructive"
                  : "secondary"
              }
            >
              {financialSignal.label}
            </Badge>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            helper={`${financialHealth.paidOrders} pedido${
              financialHealth.paidOrders === 1 ? "" : "s"
            } pago${financialHealth.paidOrders === 1 ? "" : "s"}.`}
            icon={Coins01Icon}
            label="Receita confirmada"
            value={formatCurrencyInCents(financialHealth.paidRevenueInCents)}
          />
          <AdminMetricCard
            helper="Média apenas dos pedidos pagos."
            icon={CreditCardIcon}
            label="Ticket médio pago"
            value={formatCurrencyInCents(
              financialHealth.averagePaidTicketInCents
            )}
          />
          <AdminMetricCard
            helper={`${financialHealth.pendingOrders} checkout${
              financialHealth.pendingOrders === 1 ? "" : "s"
            } ainda pendente${financialHealth.pendingOrders === 1 ? "" : "s"}.`}
            icon={Alert02Icon}
            label="Receita pendente"
            value={formatCurrencyInCents(financialHealth.pendingRevenueInCents)}
          />
          <AdminMetricCard
            helper={`${financialHealth.totalOrders} pedido${
              financialHealth.totalOrders === 1 ? "" : "s"
            } no histórico recente.`}
            icon={ShoppingCart01Icon}
            label="Conversão checkout"
            value={`${financialHealth.checkoutConversionPercent}%`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Saúde do checkout</CardTitle>
                  <CardDescription className="mt-1">
                    {financialSignal.helper}
                  </CardDescription>
                </div>
                <div className="flex size-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  <HugeiconsIcon
                    icon={Invoice01Icon}
                    size={18}
                    strokeWidth={2}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
                <FinanceStatusTile
                  label="Pendentes"
                  value={financialHealth.pendingOrders.toString()}
                />
                <FinanceStatusTile
                  label="Disputas"
                  value={financialHealth.disputedOrders.toString()}
                />
                <FinanceStatusTile
                  label="Reembolsos"
                  value={financialHealth.refundedOrders.toString()}
                />
              </div>
              <div className="border-t bg-muted/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">Conversão geral</p>
                  <span className="font-semibold text-sm">
                    {financialHealth.checkoutConversionPercent}%
                  </span>
                </div>
                <Progress
                  className="mt-3 h-2"
                  value={financialHealth.checkoutConversionPercent}
                />

                {failedWebhooks.length ? (
                  <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="font-medium text-destructive text-sm">
                      {failedWebhooks.length} webhook
                      {failedWebhooks.length === 1 ? "" : "s"} com falha
                    </p>
                    <p className="mt-1 text-destructive/80 text-xs">
                      Revise os eventos antes de liberar ou bloquear acessos
                      manualmente.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="font-medium text-emerald-600 text-sm dark:text-emerald-400">
                      Webhooks sem falha
                    </p>
                    <p className="mt-1 text-emerald-600/80 text-xs dark:text-emerald-400/80">
                      Os eventos recentes não indicam erro de processamento.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Pedidos recentes</CardTitle>
              <CardDescription className="mt-1">
                Últimos checkouts registrados pela plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <form className="mb-2 flex gap-2" method="get">
                <label className="sr-only" htmlFor="financial-order-search">
                  Buscar pedidos
                </label>
                <input
                  className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={orderSearch}
                  id="financial-order-search"
                  name="q"
                  placeholder="Pedido, checkout, pagamento ou e-mail"
                />
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
              </form>
              {recentOrders.length ? (
                recentOrders.map((order) => (
                  <FinancialOrderCard key={order.id} order={order} />
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum pedido registrado ainda.
                  </p>
                </div>
              )}
              {orderPage > 1 || recentOrders.length === 20 ? (
                <nav
                  aria-label="Paginação de pedidos"
                  className="mt-2 flex items-center justify-between gap-3"
                >
                  {orderPage > 1 ? (
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={financialPageHref({
                        page: orderPage - 1,
                        search: orderSearch,
                      })}
                    >
                      Anteriores
                    </Link>
                  ) : (
                    <span />
                  )}
                  {recentOrders.length === 20 ? (
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={financialPageHref({
                        page: orderPage + 1,
                        search: orderSearch,
                      })}
                    >
                      Próximos
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base">
              Conciliação do extrato Asaas
            </CardTitle>
            <CardDescription>
              Importe um período fechado. O extrato é paginado e cada
              movimentação é deduplicada pelo identificador do Asaas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportStatementOperation />
          </CardContent>
        </Card>

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Analytics01Icon} size={18} strokeWidth={2} />
              <CardTitle className="font-medium text-base">
                Receita por curso
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              Faturamento confirmado e conversão de checkouts por produto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoursesRevenueTable data={data.coursesRevenue} />
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Webhooks recentes</CardTitle>
              <CardDescription className="mt-1">
                Eventos recebidos do provedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.recentWebhooks.length ? (
                overview.recentWebhooks.map((event) => (
                  <div
                    className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    key={event.eventKey}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {event.eventKey}
                      </p>
                      <Badge className="shrink-0" variant="secondary">
                        {webhookStatusLabels[event.status] ?? event.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 font-medium text-sm">
                      {event.eventName}
                    </p>
                    {event.errorMessage ? (
                      <p className="mt-1 text-destructive text-xs">
                        {event.errorMessage}
                      </p>
                    ) : null}
                    <p className="mt-2 text-muted-foreground text-xs tabular-nums">
                      {formatDate(event.createdAt)}
                    </p>
                    {event.status === "failed" && session.role === "admin" ? (
                      <RetryWebhookOperation webhookEventId={event.id} />
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum webhook recebido ainda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle className="font-medium text-base">
                  Certificados recentes
                </CardTitle>
              </div>
              <CardDescription className="mt-1">
                Validação pública e emissão por curso concluído.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {recentCertificates.length ? (
                recentCertificates.map((certificate) => (
                  <Link
                    className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    href={route(`/certificados/${certificate.code}`)}
                    key={certificate.code}
                  >
                    <span className="block font-medium text-sm">
                      {certificate.studentName}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">
                      {certificate.courseTitle}
                    </span>
                    <span className="mt-2 block font-mono text-[10px] text-muted-foreground">
                      {certificate.code} - {formatDate(certificate.issuedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum certificado emitido ainda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Revisoes financeiras</CardTitle>
            <CardDescription className="mt-1">
              Divergencias nao alteram acesso ate uma decisao registrada.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.paymentReviews.length ? (
              data.paymentReviews.map((review) => (
                <PaymentReviewOperation
                  canResolveTerminalConflicts={session.role === "admin"}
                  key={review.id}
                  review={review}
                />
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma revisao financeira pendente ou recente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function FinanceStatusTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col justify-center p-5">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <p className="mt-1.5 font-bold text-2xl tracking-tight">{value}</p>
    </div>
  );
}
