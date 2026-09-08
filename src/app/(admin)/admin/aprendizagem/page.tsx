import { Analytics01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { getLessonAnalyticsMetrics } from "@/features/learning-analytics/server";

export const dynamic = "force-dynamic";

export default async function LearningAnalyticsPage(): Promise<React.JSX.Element> {
  const metrics = await getLessonAnalyticsMetrics();

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          description="Dados agregados para melhorar aulas e identificar falhas técnicas."
          title="Aprendizagem"
        />
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
                <HugeiconsIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                  icon={Download01Icon}
                />
                Exportar métricas em CSV
              </a>
            </Button>
          </div>
          <Table>
            <TableCaption className="sr-only">
              Funil agregado de aprendizagem por aula e publicação
            </TableCaption>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Aula</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Elegíveis
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Iniciaram
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Concluíram
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Checkpoint mediano
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Até concluir
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Até próxima aula
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Erros
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length > 0 ? (
                metrics.map((metric) => (
                  <TableRow key={metric.lessonId}>
                    <TableRowHeader>{metric.lessonTitle}</TableRowHeader>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {metric.coursePublicationId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metric.eligible}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metric.started}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metric.completed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(metric.medianCheckpointPercent)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatHours(metric.medianHoursToComplete)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatHours(metric.medianHoursToNextLesson)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metric.errorCount}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-48 p-0" colSpan={9}>
                    <Empty className="rounded-none border-0 p-8">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HugeiconsIcon
                            aria-hidden="true"
                            icon={Analytics01Icon}
                          />
                        </EmptyMedia>
                        <EmptyTitle as="h3">
                          Ainda não há métricas de aprendizagem
                        </EmptyTitle>
                        <EmptyDescription>
                          Os dados aparecerão quando houver aulas publicadas e
                          eventos agregados de aprendizagem.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
