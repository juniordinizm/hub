import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getLessonAnalyticsMetrics: vi.fn(),
}));

vi.mock("@/features/learning-analytics/server", () => ({
  getLessonAnalyticsMetrics: dependencies.getLessonAnalyticsMetrics,
}));

import LearningAnalyticsPage from "./page";

describe("LearningAnalyticsPage", () => {
  it("renders aggregate lesson metrics without individual engagement controls", async () => {
    dependencies.getLessonAnalyticsMetrics.mockResolvedValue([
      {
        completed: 1,
        coursePublicationId: "publication-1",
        eligible: 2,
        errorCount: 0,
        lessonId: "lesson-1",
        lessonTitle: "Primeira aula",
        medianCheckpointPercent: 50,
        medianHoursToComplete: 1.5,
        medianHoursToNextLesson: null,
        started: 2,
      },
    ]);

    const markup = renderToStaticMarkup(await LearningAnalyticsPage());

    expect(markup).toContain("Funil por aula e versão");
    expect(markup).toContain("Exportar métricas em CSV");
    expect(markup).toContain("Primeira aula");
    expect(markup).not.toContain("14 dias");
    expect(markup).not.toContain("Registrar contato manual");
    expect(markup).not.toContain("Opt-out");
  });
});
