import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getLessonAnalyticsMetricsPage: vi.fn(),
}));

vi.mock("@/features/learning-analytics/server", () => ({
  getLessonAnalyticsMetricsPage: dependencies.getLessonAnalyticsMetricsPage,
}));

import LearningAnalyticsPage from "./page";

describe("LearningAnalyticsPage", () => {
  it("renders aggregate lesson metrics without individual engagement controls", async () => {
    dependencies.getLessonAnalyticsMetricsPage.mockResolvedValue({
      hasNextPage: false,
      metrics: [
        {
          completed: 1,
          coursePublicationId: "publication-1",
          courseTitle: "Curso de exemplo",
          eligible: 2,
          errorCount: 0,
          lessonId: "lesson-1",
          lessonTitle: "Primeira aula",
          medianCheckpointPercent: 50,
          medianHoursToComplete: 1.5,
          medianHoursToNextLesson: null,
          publicationNumber: 2,
          started: 2,
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    });

    const markup = renderToStaticMarkup(await LearningAnalyticsPage({}));

    expect(markup).toContain("Funil por aula e versão");
    expect(markup).toContain("Exportar métricas em CSV");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("Primeira aula");
    expect(markup).toContain("Elegibilidade é atual");
    expect(markup).toContain("1–1 de 1 métrica");
    expect(markup).toContain("Sem base");
    expect(markup).not.toContain("14 dias");
    expect(markup).not.toContain("Registrar contato manual");
    expect(markup).not.toContain("Opt-out");
  });

  it("explains when there are no aggregate learning metrics yet", async () => {
    dependencies.getLessonAnalyticsMetricsPage.mockResolvedValue({
      hasNextPage: false,
      metrics: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
    });

    const markup = renderToStaticMarkup(await LearningAnalyticsPage({}));

    expect(markup).toContain("Ainda não há métricas de aprendizagem");
    expect(markup).toContain("eventos agregados de aprendizagem");
  });
});
