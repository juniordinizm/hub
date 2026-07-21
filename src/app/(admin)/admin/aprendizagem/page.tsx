import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { initiateLearningReengagementAction } from "@/features/learning-analytics/actions";
import {
  getInactiveLearningEnrollments,
  getLessonAnalyticsMetrics,
} from "@/features/learning-analytics/server";
import { requirePermission } from "@/lib/auth-permissions";

export const dynamic = "force-dynamic";

export default async function LearningAnalyticsPage(): Promise<React.JSX.Element> {
  const [session, metrics, inactiveEnrollments] = await Promise.all([
    requirePermission("viewAdminPanel"),
    getLessonAnalyticsMetrics(),
    getInactiveLearningEnrollments(),
  ]);

  return (
    <PageContainer>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-bold text-3xl tracking-tight">Aprendizagem</h1>
          <p className="text-muted-foreground">
            Dados opcionais e agregados para melhorar aulas e identificar falhas
            técnicas.
          </p>
        </header>
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold text-lg">Funil por aula e versão</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Elegíveis têm acesso ativo. Início e erro dependem de autorização
              opcional; conclusão continua sendo a fonte de verdade do domínio.
            </p>
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
                      {metric.courseVersionId}
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
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold text-lg">
              Sem atividade registrada há 14 dias
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Não é diagnóstico de desengajamento. Contato é manual, individual,
              auditado e somente para alunas que autorizaram a análise.
            </p>
          </div>
          <div className="space-y-4 p-5">
            {inactiveEnrollments.length ? (
              inactiveEnrollments.map((enrollment) => (
                <article
                  className="rounded-lg border p-4"
                  key={enrollment.enrollmentId}
                >
                  <p className="font-medium">{enrollment.studentName}</p>
                  <p className="text-muted-foreground text-sm">
                    {enrollment.courseTitle}
                  </p>
                  {session.role === "admin" ? (
                    <form
                      action={initiateLearningReengagementAction}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input
                        name="enrollmentId"
                        type="hidden"
                        value={enrollment.enrollmentId}
                      />
                      <input
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        defaultValue="Oferecer apoio para retomar a trilha"
                        maxLength={500}
                        name="intent"
                        required
                      />
                      <Button type="submit" variant="outline">
                        Registrar contato manual
                      </Button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma matrícula elegível sem atividade registrada.
              </p>
            )}
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
