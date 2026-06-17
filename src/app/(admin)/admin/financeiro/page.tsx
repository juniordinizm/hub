import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAdminManagementData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
  ]);

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="space-y-8">
        <header>
          <Badge variant="outline">Financeiro</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Pedidos, webhooks e certificados
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Acompanhe pagamentos AbacatePay, eventos recebidos e certificados
            emitidos.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
              <CardDescription>Últimos pedidos registrados.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.orders.length ? (
                data.orders.map((order) => (
                  <div className="rounded-lg border p-3" key={order.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {order.customerName ?? "-"}
                      </p>
                      <Badge variant="secondary">{order.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {order.customerEmail ?? "-"} - {order.courseTitle}
                    </p>
                    <p className="mt-2 font-mono text-xs">
                      {order.providerOrderId}
                    </p>
                    <p className="mt-2 text-sm">
                      {formatCurrencyInCents(order.amountInCents)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum pedido registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
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
                      <Badge variant="outline">{event.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm">{event.eventName}</p>
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

          <Card>
            <CardHeader>
              <CardTitle>Certificados</CardTitle>
              <CardDescription>Validação pública e emissão.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.certificates.length ? (
                data.certificates.map((certificate) => (
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
