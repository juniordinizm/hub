import Link from "next/link";
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
  getAdminManagementData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const metrics = [
  ["Cursos", "courses"],
  ["Alunas", "students"],
  ["Matriculas ativas", "activeEnrollments"],
  ["Pedidos pagos", "paidOrders"],
] as const;

const quickLinks = [
  ["Catalogo", "Cursos, modulos, aulas e videos JMVStream.", "/admin/cursos"],
  ["Alunas", "Convites, acessos e matriculas.", "/admin/alunas"],
  ["Financeiro", "Pedidos, webhooks e certificados.", "/admin/financeiro"],
  ["FAQ", "Perguntas frequentes exibidas para alunas.", "/admin/faq"],
  [
    "Configuracoes",
    "WhatsApp, certificado e AbacatePay.",
    "/admin/configuracoes",
  ],
] as const;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Operacao</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Painel administrativo
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Visao geral do Hub. Use o menu lateral para administrar catalogo,
          alunas, financeiro, FAQ e configuracoes separadamente.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {metrics.map(([label, key]) => (
          <Card key={key} size="sm">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{overview[key]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {quickLinks.map(([title, description, href]) => (
          <Card className="py-0" key={href}>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <Button asChild size="sm" variant="secondary">
                <Link href={route(href)}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Webhooks recentes</CardTitle>
            <CardDescription>Ultimos eventos recebidos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {overview.recentWebhooks.length ? (
              overview.recentWebhooks.map((event) => (
                <div className="rounded-lg border p-3" key={event.eventKey}>
                  <p className="font-mono text-xs">{event.eventKey}</p>
                  <p className="mt-1 text-sm">
                    {event.eventName} - {event.status}
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
            <CardTitle>Auditoria recente</CardTitle>
            <CardDescription>
              Ultimas alteracoes administrativas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.auditLogs.length ? (
              data.auditLogs.slice(0, 8).map((log) => (
                <div
                  className="rounded-lg border p-3"
                  key={`${log.action}-${log.createdAt.toISOString()}`}
                >
                  <p className="text-sm">{log.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {log.actorEmail ?? "sistema"} - {log.targetType} -{" "}
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum registro de auditoria ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
