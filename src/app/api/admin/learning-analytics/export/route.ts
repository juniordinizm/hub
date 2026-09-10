import { parseLearningAnalyticsPeriod } from "@/features/learning-analytics/period";
import { getLessonAnalyticsMetrics } from "@/features/learning-analytics/server";

export const runtime = "nodejs";

const escapeCsv = (value: number | string | null): string =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const courseId = requestUrl.searchParams.get("courseId")?.trim();
  const period = parseLearningAnalyticsPeriod(
    requestUrl.searchParams.get("period")?.trim()
  );

  if (!courseId) {
    return Response.json(
      { error: "Selecione um Curso antes de exportar as métricas." },
      { status: 400 }
    );
  }

  const metrics = await getLessonAnalyticsMetrics({ courseId, period });
  const header = [
    "curso",
    "ordem_modulo",
    "ordem_aula",
    "modulo",
    "aula",
    "versao_curso",
    "status_versao",
    "matriculas_ativas",
    "iniciaram",
    "concluiram",
    "checkpoint_mediano_percentual",
    "mediana_horas_ate_concluir",
    "mediana_horas_ate_proxima_aula",
    "erros",
  ];
  const rows = metrics.map((metric) =>
    [
      metric.courseTitle,
      metric.moduleSortOrder,
      metric.lessonSortOrder,
      metric.moduleTitle,
      metric.lessonTitle,
      metric.publicationNumber,
      metric.publicationStatus,
      metric.activeEnrollments,
      metric.started,
      metric.completed,
      metric.medianCheckpointPercent,
      metric.medianHoursToComplete,
      metric.medianHoursToNextLesson,
      metric.errorCount,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return new Response([header.join(","), ...rows].join("\n"), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="aprendizagem.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
