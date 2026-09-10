import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getLessonAnalyticsMetrics: vi.fn(),
}));

vi.mock("@/features/learning-analytics/server", () => ({
  getLessonAnalyticsMetrics: dependencies.getLessonAnalyticsMetrics,
}));

import { GET, runtime } from "./route";

describe("GET /api/admin/learning-analytics/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a selected course", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/learning-analytics/export")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Selecione um Curso antes de exportar as métricas.",
    });
    expect(dependencies.getLessonAnalyticsMetrics).not.toHaveBeenCalled();
  });

  it("returns a no-store CSV with escaped metric values", async () => {
    dependencies.getLessonAnalyticsMetrics.mockResolvedValue([
      {
        activeEnrollments: 5,
        completed: 2,
        coursePublicationId: "publication-1",
        courseTitle: "Curso de exemplo",
        errorCount: 1,
        lessonId: "lesson-1",
        lessonSortOrder: 2,
        lessonTitle: 'Aula "Inicial", 1',
        medianCheckpointPercent: 75.5,
        medianHoursToComplete: null,
        medianHoursToNextLesson: 2,
        moduleSortOrder: 1,
        moduleTitle: "Módulo inicial",
        publicationNumber: 3,
        publicationStatus: "published",
        started: 4,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/learning-analytics/export?courseId=course-1&period=30d"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="aprendizagem.csv"'
    );
    expect(response.headers.get("content-type")).toContain("text/csv");
    await expect(response.text()).resolves.toBe(
      [
        "curso,ordem_modulo,ordem_aula,modulo,aula,versao_curso,status_versao,matriculas_ativas,iniciaram,concluiram,checkpoint_mediano_percentual,mediana_horas_ate_concluir,mediana_horas_ate_proxima_aula,erros",
        '"Curso de exemplo","1","2","Módulo inicial","Aula ""Inicial"", 1","3","published","5","4","2","75.5","","2","1"',
      ].join("\n")
    );
    expect(dependencies.getLessonAnalyticsMetrics).toHaveBeenCalledWith({
      courseId: "course-1",
      period: "30d",
    });
  });

  it("does not generate a file when the permission guard rejects", async () => {
    const forbidden = new Error("permission denied for analytics");
    dependencies.getLessonAnalyticsMetrics.mockRejectedValue(forbidden);

    await expect(
      GET(
        new Request(
          "http://localhost/api/admin/learning-analytics/export?courseId=course-1"
        )
      )
    ).rejects.toBe(forbidden);
    expect(dependencies.getLessonAnalyticsMetrics).toHaveBeenCalledWith({
      courseId: "course-1",
      period: "90d",
    });
  });

  it("uses the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });
});
