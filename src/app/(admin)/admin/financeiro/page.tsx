import {
  Analytics01Icon,
  Certificate01Icon,
  Invoice01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  getAdminFinancialSignal,
  summarizeAdminFinancialHealth,
} from "@/features/admin/presentation";
import {
  getAdminManagementData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { CoursesRevenueTable } from "./courses-revenue-table";

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

export default async function AdminFinancePage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
  ]);
  const financialHealth = summarizeAdminFinancialHealth(data.orders);
  const financialSignal = getAdminFinancialSignal(financialHealth);
  const recentOrders = data.orders.slice(0, 8);
  const recentCertificates = data.certificates.slice(0, 6);
  const failedWebhooks = overview.recentWebhooks.filter(
    (event) => event.status === "failed"
  );

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="space-y-8">
        <header className="border-b pb-6">
          <Badge variant="outline">Financeiro</Badge>
          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="font-bold text-3xl tracking-tight">
                Receita e liberacao de acesso
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                Acompanhe checkouts, pagamentos confirmados, disputas, webhooks
                e certificados emitidos para cada curso vendido separadamente.
              </p>
            </div>
            <Badge
              className="w-fit"
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
          <FinanceMetricCard
            helper={`${financialHealth.paidOrders} pedido${
              financialHealth.paidOrders === 1 ? "" : "s"
            } pago${financialHealth.paidOrders === 1 ? "" : "s"}.`}
            label="Receita confirmada"
            value={formatCurrencyInCents(financialHealth.paidRevenueInCents)}
          />
          <FinanceMetricCard
            helper="Media apenas dos pedidos pagos."
            label="Ticket medio pago"
            value={formatCurrencyInCents(
              financialHealth.averagePaidTicketInCents
            )}
          />
          <FinanceMetricCard
            helper={`${financialHealth.pendingOrders} checkout${
              financialHealth.pendingOrders === 1 ? "" : "s"
            } ainda pendente${financialHealth.pendingOrders === 1 ? "" : "s"}.`}
            label="Receita pendente"
            value={formatCurrencyInCents(financialHealth.pendingRevenueInCents)}
          />
          <FinanceMetricCard
            helper={`${financialHealth.totalOrders} pedido${
              financialHealth.totalOrders === 1 ? "" : "s"
            } no historico recente.`}
            label="Conversao checkout"
            value={`${financialHealth.checkoutConversionPercent}%`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <Card className="border-border/40 bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Saude do checkout</CardTitle>
                  <CardDescription>{financialSignal.helper}</CardDescription>
                </div>
                <HugeiconsIcon icon={Invoice01Icon} size={22} strokeWidth={2} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">Conversao geral</p>
                  <span className="font-semibold text-sm">
                    {financialHealth.checkoutConversionPercent}%
                  </span>
                </div>
                <Progress
                  className="mt-3 h-2"
                  value={financialHealth.checkoutConversionPercent}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
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
              {failedWebhooks.length ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="font-semibold text-sm">
                    {failedWebhooks.length} webhook
                    {failedWebhooks.length === 1 ? "" : "s"} com falha
                  </p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Revise os eventos antes de liberar ou bloquear acessos
                    manualmente.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="font-semibold text-sm">Webhooks sem falha</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Os eventos recentes nao indicam erro de processamento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Pedidos recentes</CardTitle>
              <CardDescription>
                Ultimos checkouts registrados pela plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-0">
              {recentOrders.length ? (
                recentOrders.map((order, index) => (
                  <div key={order.id}>
                    <div className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-sm">
                          {order.customerName ?? order.customerEmail ?? "Aluno"}
                        </p>
                        <Badge variant="outline">
                          {orderStatusLabels[order.status] ?? order.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground text-xs">
                        {order.courseTitle}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium">
                          {formatCurrencyInCents(order.amountInCents)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-mono text-muted-foreground">
                          {order.providerOrderId}
                        </span>
                      </div>
                    </div>
                    {index < recentOrders.length - 1 ? <Separator /> : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum pedido registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/40 bg-background/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Analytics01Icon} size={18} strokeWidth={2} />
              <CardTitle>Receita por curso</CardTitle>
            </div>
            <CardDescription>
              Faturamento confirmado e conversao de checkouts por produto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoursesRevenueTable data={data.coursesRevenue} />
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border/40 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle>Webhooks recentes</CardTitle>
              <CardDescription>Eventos recebidos do provedor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {overview.recentWebhooks.length ? (
                overview.recentWebhooks.map((event) => (
                  <div className="rounded-lg border p-3" key={event.eventKey}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs">{event.eventKey}</p>
                      <Badge variant="outline">
                        {webhookStatusLabels[event.status] ?? event.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm">{event.eventName}</p>
                    {event.errorMessage ? (
                      <p className="mt-1 text-destructive text-xs">
                        {event.errorMessage}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum webhook recebido ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-background/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle>Certificados recentes</CardTitle>
              </div>
              <CardDescription>
                Validacao publica e emissao por curso concluido.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recentCertificates.length ? (
                recentCertificates.map((certificate) => (
                  <Link
                    className="rounded-lg border p-3 hover:bg-muted"
                    href={route(`/certificados/${certificate.code}`)}
                    key={certificate.code}
                  >
                    <span className="block font-semibold">
                      {certificate.studentName}
                    </span>
                    <span className="block text-muted-foreground text-xs">
                      {certificate.courseTitle}
                    </span>
                    <span className="mt-2 block font-mono text-xs">
                      {certificate.code} - {formatDate(certificate.issuedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum certificado emitido ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function FinanceMetricCard({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <Card className="border-border/40 bg-background/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-bold text-3xl tracking-tight">{value}</p>
        <p className="mt-2 text-muted-foreground text-xs">{helper}</p>
      </CardContent>
    </Card>
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
    <div className="rounded-lg border bg-background/45 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-2xl tracking-tight">{value}</p>
    </div>
  );
}
