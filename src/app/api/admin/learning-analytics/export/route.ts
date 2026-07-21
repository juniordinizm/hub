import { getLessonAnalyticsMetrics } from "@/features/learning-analytics/server";

export const runtime = "nodejs";

const escapeCsv = (value: number | string | null): string =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(): Promise<Response> {
  const metrics = await getLessonAnalyticsMetrics();
  const header = [
    "aula",
    "versao_curso",
    "elegiveis",
    "iniciaram",
    "concluiram",
    "checkpoint_mediano_percentual",
    "mediana_horas_ate_concluir",
    "mediana_horas_ate_proxima_aula",
    "erros",
  ];
  const rows = metrics.map((metric) =>
    [
      metric.lessonTitle,
      metric.courseVersionId,
      metric.eligible,
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
