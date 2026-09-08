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
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  getCheckoutStatusPresentation,
  getOrderStatusPresentation,
  getProviderPaymentStatusPresentation,
  getRefundRequestStatusPresentation,
  getWebhookStatusPresentation,
} from "@/features/admin/status-presentation";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
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

const readSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const financialPageHref = ({
  page,
  revenuePage,
  revenueSearch,
  search,
}: {
  page: number;
  revenuePage: number;
  revenueSearch: string;
  search: string;
}): string => {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  if (revenueSearch) {
    params.set("revenueQ", revenueSearch);
  }
  if (revenuePage > 1) {
    params.set("revenuePage", String(revenuePage));
  }
  const query = params.toString();
  return query ? `/admin/financeiro?${query}` : "/admin/financeiro";
};

interface FinancialSearchParams {
  page?: string | string[] | undefined;
  q?: string | string[] | undefined;
  revenuePage?: string | string[] | undefined;
  revenueQ?: string | string[] | undefined;
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

const getRevenueQuery = (
  searchParams: FinancialSearchParams
): { page: number; search: string } => {
  const search = readSearchParameter(searchParams.revenueQ).trim();
  const requestedPage = Number.parseInt(
    readSearchParameter(searchParams.revenuePage),
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

export function FinancialOrderCard({
  canManageFinancialOperations,
  hasPendingBuyerIdentityReview,
  order,
}: {
  canManageFinancialOperations: boolean;
  hasPendingBuyerIdentityReview: boolean;
  order: AdminOrder;
}): React.JSX.Element {
  const orderStatus = getOrderStatusPresentation(order.status);
  const checkoutStatus = getCheckoutStatusPresentation(order.checkoutStatus);
  const paymentStatus = order.providerPaymentStatus
    ? getProviderPaymentStatusPresentation(order.providerPaymentStatus)
    : null;
  const refundStatus = order.refundRequestStatus
    ? getRefundRequestStatusPresentation(order.refundRequestStatus)
    : null;

  return (
    <div className="flex flex-col justify-between border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-medium text-sm">
          {order.customerName ?? order.customerEmail ?? "Aluna"}
        </p>
        <Badge
          aria-label={`Status do pedido: ${orderStatus.label}`}
          className="shrink-0"
          variant={orderStatus.variant}
        >
          {orderStatus.label}
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
        <span className="font-mono text-muted-foreground text-xs">
          checkout {order.providerCheckoutId ?? "pendente"}
        </span>
        <span className="font-mono text-muted-foreground text-xs">
          pagamento {order.providerPaymentId ?? "não correlacionado"}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        {order.paymentMethod ?? "Método pendente"} · checkout{" "}
        {checkoutStatus.label} · pagamento {paymentStatus?.label ?? "Pendente"}
        {refundStatus ? ` · reembolso ${refundStatus.label}` : ""}
      </p>
      {order.status === "paid" && !hasPendingBuyerIdentityReview ? (
        <RefundOperation orderId={order.id} />
      ) : null}
      {canManageFinancialOperations && order.providerPaymentId ? (
        <ReconcilePaymentOperation orderId={order.id} />
      ) : null}
    </div>
  );
}

export function FinancialStatementImportCard({
  canManageFinancialOperations,
}: {
  canManageFinancialOperations: boolean;
}): React.JSX.Element | null {
  if (!canManageFinancialOperations) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="text-base">
          Importação do extrato Asaas
        </CardTitle>
        <CardDescription>
          Importe um período fechado. O extrato é paginado e cada movimentação é
          deduplicada pelo identificador do Asaas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ImportStatementOperation />
      </CardContent>
    </Card>
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
  const { page: revenuePage, search: revenueSearch } =
    getRevenueQuery(resolvedSearchParams);

  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminFinancialData(
      { page: orderPage, search: orderSearch },
      { page: revenuePage, search: revenueSearch }
    ),
  ]);
  const financialHealth = summarizeAdminFinancialHealth(data.orders);
  const financialSignal = getAdminFinancialSignal(financialHealth);
  const canManageFinancialOperations = canPerform(
    session.role,
    "manageFinancialOperations"
  );
  const canManageFinancialReviews = canPerform(
    session.role,
    "manageFinancialReviews"
  );
  const recentOrders = data.orders;
  const recentCertificates = data.certificates.slice(0, 6);
  const pendingBuyerIdentityReviewOrderIds = new Set(
    data.paymentReviews
      .filter(
        (review) =>
          review.status === "pending" && review.type === "buyer_identity"
      )
      .map((review) => review.orderId)
  );
  const failedWebhooks = overview.recentWebhooks.filter(
    (event) => event.status === "failed"
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Acompanhe checkouts, pagamentos confirmados, disputas, webhooks e certificados emitidos."
          status={
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
          }
          title="Receita e liberação de acesso"
        />

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
          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle as="h2" className="text-base">
                    Saúde do checkout
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {financialSignal.helper}
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
                  aria-label={`Conversão geral de checkouts: ${financialHealth.checkoutConversionPercent}%`}
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
                  <div className="mt-5 rounded-lg border border-success/20 bg-success/10 p-4">
                    <p className="font-medium text-foreground text-sm">
                      Webhooks sem falha
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Os eventos recentes não indicam erro de processamento.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Pedidos recentes
              </CardTitle>
              <CardDescription className="mt-1">
                Últimos checkouts registrados pela plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <form className="mb-2 flex gap-2" method="get">
                <label className="sr-only" htmlFor="financial-order-search">
                  Buscar pedidos
                </label>
                <Input
                  aria-label="Buscar pedidos"
                  autoComplete="off"
                  className="min-w-0 flex-1"
                  defaultValue={orderSearch}
                  id="financial-order-search"
                  name="q"
                  placeholder="Pedido, checkout, pagamento ou e-mail…"
                />
                <input name="page" type="hidden" value="1" />
                <input name="revenueQ" type="hidden" value={revenueSearch} />
                <input name="revenuePage" type="hidden" value={revenuePage} />
                <Button type="submit" variant="outline">
                  Buscar
                </Button>
              </form>
              {recentOrders.length ? (
                recentOrders.map((order) => (
                  <FinancialOrderCard
                    canManageFinancialOperations={canManageFinancialOperations}
                    hasPendingBuyerIdentityReview={pendingBuyerIdentityReviewOrderIds.has(
                      order.id
                    )}
                    key={order.id}
                    order={order}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum pedido registrado ainda.
                  </p>
                </div>
              )}
              {orderPage > 1 || data.ordersHasNextPage ? (
                <nav
                  aria-label="Paginação de pedidos"
                  className="mt-2 flex items-center justify-between gap-3"
                >
                  {orderPage > 1 ? (
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={financialPageHref({
                        page: orderPage - 1,
                        revenuePage,
                        revenueSearch,
                        search: orderSearch,
                      })}
                    >
                      Anteriores
                    </Link>
                  ) : (
                    <span />
                  )}
                  {data.ordersHasNextPage ? (
                    <Link
                      className="text-sm underline underline-offset-4"
                      href={financialPageHref({
                        page: orderPage + 1,
                        revenuePage,
                        revenueSearch,
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

        <FinancialStatementImportCard
          canManageFinancialOperations={canManageFinancialOperations}
        />

        <Card>
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
              Faturamento confirmado e conversão de checkouts por produto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoursesRevenueTable
              data={data.coursesRevenue.courses}
              hasNextPage={data.coursesRevenue.hasNextPage}
              orderPage={orderPage}
              orderSearch={orderSearch}
              page={data.coursesRevenue.page}
              pageSize={data.coursesRevenue.pageSize}
              search={data.coursesRevenue.search}
              totalCount={data.coursesRevenue.totalCount}
            />
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Webhooks recentes
              </CardTitle>
              <CardDescription className="mt-1">
                Eventos recebidos do provedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.recentWebhooks.length ? (
                overview.recentWebhooks.map((event) => (
                  <div
                    className="flex flex-col justify-between border-b py-3 last:border-b-0"
                    key={event.eventKey}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-muted-foreground text-xs">
                        {event.eventKey}
                      </p>
                      <WebhookStatusBadge status={event.status} />
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

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle as="h2" className="font-medium text-base">
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
                    <span className="mt-2 block font-mono text-muted-foreground text-xs">
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

        <Card>
          <CardHeader className="pb-4">
            <CardTitle as="h2" className="text-base">
              Revisões financeiras
            </CardTitle>
            <CardDescription className="mt-1">
              Divergências não alteram acesso até uma decisão registrada.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.paymentReviews.length ? (
              data.paymentReviews.map((review) => (
                <PaymentReviewOperation
                  canManageFinancialReviews={canManageFinancialReviews}
                  key={review.id}
                  review={review}
                />
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma revisão financeira pendente ou recente.
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
      <p className="mt-1.5 font-bold text-2xl tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function WebhookStatusBadge({ status }: { status: string }): React.JSX.Element {
  const presentation = getWebhookStatusPresentation(status);

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
