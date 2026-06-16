import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getAdminOverview } from "@/features/admin/server";

export const dynamic = "force-dynamic";

const metrics = [
  ["Cursos", "courses"],
  ["Alunos", "students"],
  ["Matriculas ativas", "activeEnrollments"],
  ["Pedidos pagos", "paidOrders"],
] as const;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const overview = await getAdminOverview();

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Operacao</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Painel administrativo
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Visao geral do Hub. Use o menu lateral para administrar catalogo,
          alunos, financeiro, FAQ e configuracoes separadamente.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, key]) => (
          <Card
            className="border-border/40 bg-background/50 shadow-sm"
            key={key}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-4xl tracking-tight">
                {overview[key]}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-8">
        <Card className="border-border/40 bg-background/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-semibold text-lg">
              Webhooks recentes
            </CardTitle>
            <CardDescription>Ultimos eventos recebidos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {overview.recentWebhooks.length ? (
              overview.recentWebhooks.map((event) => (
                <div
                  className="flex flex-col justify-center border-border/50 border-l-2 py-1 pl-4 transition-colors hover:border-primary/50"
                  key={event.eventKey}
                >
                  <p className="font-mono text-muted-foreground text-xs">
                    {event.eventKey}
                  </p>
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
