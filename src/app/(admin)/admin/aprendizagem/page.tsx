import { Analytics01Icon, Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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
import { getLessonAnalyticsMetricsPage } from "@/features/learning-analytics/server";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const getMetricResultSummary = ({
  metricCount,
  page,
  pageSize,
  totalCount,
}: {
  metricCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return "Nenhuma métrica";
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + metricCount - 1, totalCount);
  return `${firstResult}–${lastResult} de ${totalCount} métrica${totalCount === 1 ? "" : "s"}`;
};

export default async function LearningAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}): Promise<React.JSX.Element> {
  const params = (await searchParams) ?? {};
  const requestedPage = Number.parseInt(
    firstSearchParam(params.page) ?? "1",
    10
  );
  const data = await getLessonAnalyticsMetricsPage({
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });
  const metrics = data.metrics;
  const resultSummary = getMetricResultSummary({
    metricCount: metrics.length,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
  });
  const pageHref = (page: number): string =>
    page > 1
      ? route(`/admin/aprendizagem?page=${page}`)
      : route("/admin/aprendizagem");

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          description="Relatório avançado agregado para melhorar aulas e identificar falhas técnicas."
          title="Relatório de aprendizagem"
        />
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-lg">Funil por aula e versão</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Elegíveis têm acesso ativo e não desativaram análises opcionais.
                Conclusão continua sendo a fonte de verdade do domínio.
              </p>
              <p className="mt-2 text-muted-foreground text-xs">
                Elegibilidade é atual; inícios e erros cobrem até 13 meses;
                tempos de conclusão e avanço usam os últimos 90 dias.
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
                <TableHead>Curso</TableHead>
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
                    <TableRowHeader>{metric.courseTitle}</TableRowHeader>
                    <TableCell>{metric.lessonTitle}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      v{metric.publicationNumber}
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
                  <TableCell className="h-48 p-0" colSpan={10}>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
            <span aria-live="polite" className="text-muted-foreground text-sm">
              {resultSummary}
            </span>
            {data.page > 1 || data.hasNextPage ? (
              <nav
                aria-label="Paginação do relatório de aprendizagem"
                className="flex gap-2"
              >
                {data.page > 1 ? (
                  <Button asChild variant="outline">
                    <Link href={pageHref(data.page - 1)}>Anterior</Link>
                  </Button>
                ) : null}
                {data.hasNextPage ? (
                  <Button asChild variant="outline">
                    <Link href={pageHref(data.page + 1)}>Próxima</Link>
                  </Button>
                ) : null}
              </nav>
            ) : null}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function formatHours(value: number | null): string {
  return value === null ? "Sem base" : `${value.toFixed(1)} h`;
}

function formatPercent(value: number | null): string {
  return value === null ? "Sem base" : `${Math.round(value)}%`;
}
