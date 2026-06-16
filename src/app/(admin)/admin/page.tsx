import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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

      <section className="grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, key]) => (
          <div className="flex flex-col gap-1" key={key}>
            <p className="font-medium text-muted-foreground text-sm">{label}</p>
            <p className="font-bold text-4xl tracking-tight">{overview[key]}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 font-semibold text-lg">Acesso rapido</h2>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(([title, description, href]) => (
            <div
              className="group relative border-border/50 border-b py-3"
              key={href}
            >
              <Link className="absolute inset-0 z-10" href={route(href)}>
                <span className="sr-only">Abrir {title}</span>
              </Link>
              <p className="font-semibold text-foreground transition-colors group-hover:text-primary">
                {title}
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-4">
            <h2 className="font-semibold text-lg">Webhooks recentes</h2>
            <p className="text-muted-foreground text-sm">
              Ultimos eventos recebidos.
            </p>
          </div>
          <div className="grid gap-3">
            {overview.recentWebhooks.length ? (
              overview.recentWebhooks.map((event) => (
                <div
                  className="flex flex-col justify-center border-border/50 border-l-2 py-1 pl-4"
                  key={event.eventKey}
                >
                  <p className="font-mono text-xs">{event.eventKey}</p>
                  <p className="mt-1 font-medium text-foreground text-sm">
                    {event.eventName}{" "}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({event.status})
                    </span>
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum webhook recebido ainda.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="font-semibold text-lg">Auditoria recente</h2>
            <p className="text-muted-foreground text-sm">
              Ultimas alteracoes administrativas.
            </p>
          </div>
          <div className="grid gap-3">
            {data.auditLogs.length ? (
              data.auditLogs.slice(0, 8).map((log) => (
                <div
                  className="flex flex-col justify-center border-border/50 border-l-2 py-1 pl-4"
                  key={`${log.action}-${log.createdAt.toISOString()}`}
                >
                  <p className="font-medium text-foreground text-sm">
                    {log.action}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {log.actorEmail ?? "sistema"}{" "}
                    <span className="mx-1">&middot;</span> {log.targetType}{" "}
                    <span className="mx-1">&middot;</span>{" "}
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhum registro de auditoria ainda.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
