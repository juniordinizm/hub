import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminManagementData } from "@/features/admin/server";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header>
          <Badge variant="outline">Auditoria</Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Registro de Auditoria
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Acompanhe as ultimas alteracoes administrativas no sistema.
          </p>
        </header>

        <Card className="border-border/40 bg-background/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-semibold text-lg">
              Auditoria recente
            </CardTitle>
            <CardDescription>
              Historico de todas as acoes realizadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {data.auditLogs.length ? (
              data.auditLogs.map((log) => (
                <div
                  className="flex flex-col justify-center border-border/50 border-l-2 py-2 pl-4 transition-colors hover:border-primary/50"
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
                Nenhum registro de auditoria encontrado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
