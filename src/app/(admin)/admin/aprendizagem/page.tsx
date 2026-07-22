import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { getLessonAnalyticsMetrics } from "@/features/learning-analytics/server";

export const dynamic = "force-dynamic";

export default async function LearningAnalyticsPage(): Promise<React.JSX.Element> {
  const metrics = await getLessonAnalyticsMetrics();

  return (
    <PageContainer>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-bold text-3xl tracking-tight">Aprendizagem</h1>
          <p className="text-muted-foreground">
            Dados agregados para melhorar aulas e identificar falhas técnicas.
          </p>
        </header>
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-lg">Funil por aula e versão</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Elegíveis têm acesso ativo e não desativaram análises opcionais.
                Conclusão continua sendo a fonte de verdade do domínio.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href="/api/admin/learning-analytics/export">
                <HugeiconsIcon icon={Download01Icon} />
                Exportar métricas em CSV
              </a>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left">
                <tr>
                  <th className="p-4">Aula</th>
                  <th className="p-4">Versão</th>
                  <th className="p-4 text-right">Elegíveis</th>
                  <th className="p-4 text-right">Iniciaram</th>
                  <th className="p-4 text-right">Concluíram</th>
                  <th className="p-4 text-right">Checkpoint mediano</th>
                  <th className="p-4 text-right">Até concluir</th>
                  <th className="p-4 text-right">Até próxima aula</th>
                  <th className="p-4 text-right">Erros</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr className="border-t" key={metric.lessonId}>
                    <td className="p-4">{metric.lessonTitle}</td>
                    <td className="p-4 font-mono text-xs">
                      {metric.coursePublicationId}
                    </td>
                    <td className="p-4 text-right">{metric.eligible}</td>
                    <td className="p-4 text-right">{metric.started}</td>
                    <td className="p-4 text-right">{metric.completed}</td>
                    <td className="p-4 text-right">
                      {formatPercent(metric.medianCheckpointPercent)}
                    </td>
                    <td className="p-4 text-right">
                      {formatHours(metric.medianHoursToComplete)}
                    </td>
                    <td className="p-4 text-right">
                      {formatHours(metric.medianHoursToNextLesson)}
                    </td>
                    <td className="p-4 text-right">{metric.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function formatHours(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} h`;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}
