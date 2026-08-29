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

  it("returns a no-store CSV with escaped metric values", async () => {
    dependencies.getLessonAnalyticsMetrics.mockResolvedValue([
      {
        completed: 2,
        coursePublicationId: "publication-1",
        eligible: 5,
        errorCount: 1,
        lessonId: "lesson-1",
        lessonTitle: 'Aula "Inicial", 1',
        medianCheckpointPercent: 75.5,
        medianHoursToComplete: null,
        medianHoursToNextLesson: 2,
        started: 4,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="aprendizagem.csv"'
    );
    expect(response.headers.get("content-type")).toContain("text/csv");
    await expect(response.text()).resolves.toBe(
      [
        "aula,versao_curso,elegiveis,iniciaram,concluiram,checkpoint_mediano_percentual,mediana_horas_ate_concluir,mediana_horas_ate_proxima_aula,erros",
        '"Aula ""Inicial"", 1","publication-1","5","4","2","75.5","","2","1"',
      ].join("\n")
    );
    expect(dependencies.getLessonAnalyticsMetrics).toHaveBeenCalledOnce();
  });

  it("does not generate a file when the permission guard rejects", async () => {
    const forbidden = new Error("permission denied for analytics");
    dependencies.getLessonAnalyticsMetrics.mockRejectedValue(forbidden);

    await expect(GET()).rejects.toBe(forbidden);
    expect(dependencies.getLessonAnalyticsMetrics).toHaveBeenCalledOnce();
  });

  it("uses the Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
  });
});
