import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getLearningAnalyticsCourseOptions: vi.fn(),
  getLessonAnalyticsMetrics: vi.fn(),
}));

vi.mock("@/features/learning-analytics/server", () => ({
  getLearningAnalyticsCourseOptions:
    dependencies.getLearningAnalyticsCourseOptions,
  getLessonAnalyticsMetrics: dependencies.getLessonAnalyticsMetrics,
}));
vi.mock("./learning-analytics-filters", () => ({
  LearningAnalyticsFilters: () => <div>Filtros de Aprendizagem</div>,
}));
vi.mock("./lesson-analytics-details-sheet", () => ({
  LessonAnalyticsDetailsSheet: () => <button type="button">Detalhes</button>,
}));

import LearningAnalyticsPage from "./page";

describe("LearningAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one ordered row per lesson and combines version metrics", async () => {
    dependencies.getLearningAnalyticsCourseOptions.mockResolvedValue([
      {
        id: "course-1",
        lessonCount: 2,
        publicationNumber: 2,
        title: "Curso de exemplo",
      },
    ]);
    dependencies.getLessonAnalyticsMetrics.mockResolvedValue([
      {
        activeEnrollments: 2,
        completed: 1,
        courseId: "course-1",
        coursePublicationId: "publication-2",
        courseTitle: "Curso de exemplo",
        courseAverageViewingPercent: 62.5,
        curriculumKey: "curriculum-1",
        errorCount: 0,
        lessonId: "lesson-1-v2",
        lessonSortOrder: 1,
        lessonTitle: "Primeira aula",
        medianCheckpointPercent: 50,
        medianHoursToComplete: 1.5,
        medianHoursToNextLesson: null,
        moduleSortOrder: 1,
        moduleTitle: "Módulo 1",
        publicationNumber: 2,
        publicationStatus: "published",
        started: 2,
        aggregateMedianCheckpointPercent: 45,
        aggregateMedianHoursToComplete: 1.75,
        aggregateMedianHoursToNextLesson: null,
      },
      {
        activeEnrollments: 2,
        completed: 2,
        courseId: "course-1",
        coursePublicationId: "publication-2",
        courseTitle: "Curso de exemplo",
        courseAverageViewingPercent: 62.5,
        curriculumKey: "curriculum-2",
        errorCount: 3,
        lessonId: "lesson-2-v2",
        lessonSortOrder: 2,
        lessonTitle: "Segunda aula",
        medianCheckpointPercent: null,
        medianHoursToComplete: 4,
        medianHoursToNextLesson: 1,
        moduleSortOrder: 1,
        moduleTitle: "Módulo 1",
        publicationNumber: 2,
        publicationStatus: "published",
        started: 2,
        aggregateMedianCheckpointPercent: null,
        aggregateMedianHoursToComplete: 4,
        aggregateMedianHoursToNextLesson: 1,
      },
      {
        activeEnrollments: 0,
        completed: 0,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        courseTitle: "Curso de exemplo",
        courseAverageViewingPercent: 62.5,
        curriculumKey: "curriculum-1",
        errorCount: 1,
        lessonId: "lesson-1-v1",
        lessonSortOrder: 1,
        lessonTitle: "Primeira aula antiga",
        medianCheckpointPercent: 40,
        medianHoursToComplete: 2,
        medianHoursToNextLesson: null,
        moduleSortOrder: 1,
        moduleTitle: "Módulo 1 antigo",
        publicationNumber: 1,
        publicationStatus: "retired",
        started: 1,
        aggregateMedianCheckpointPercent: 45,
        aggregateMedianHoursToComplete: 1.75,
        aggregateMedianHoursToNextLesson: null,
      },
    ]);

    const markup = renderToStaticMarkup(await LearningAnalyticsPage({}));

    expect(markup).toContain("Filtros de Aprendizagem");
    expect(markup).toContain("Visão rápida");
    expect(markup).toContain("Contagens em 3 meses");
    expect(markup).toContain("Mais opções do relatório de aprendizagem");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("Primeira aula");
    expect(markup).toContain("Segunda aula");
    expect(markup).toContain("Aula 01");
    expect(markup).toContain("Aula 02");
    expect(markup).not.toContain("Publicação vigente · v2");
    expect(markup).not.toContain("1–2 de 2 Aulas");
    expect(markup).toContain("Aulas sem início");
    expect(markup).toContain("Visualização média do Curso");
    expect(markup).toContain("Visualização média do Curso: 63%");
    expect(markup).toContain('data-slot="progress"');
    expect(markup).not.toContain("Conclusão mais rápida");
    expect(markup).not.toContain("Conclusão mais demorada");
    expect(markup).not.toContain("Aula com mais erros");
    expect(markup).toContain("3");
    expect(markup).toContain("—");
    expect(markup).not.toContain("14 dias");
    expect(markup).not.toContain("Registrar contato manual");
    expect(markup).not.toContain("Opt-out");
    expect(dependencies.getLessonAnalyticsMetrics).toHaveBeenCalledWith({
      courseId: "course-1",
      period: "90d",
    });
  });

  it("explains when there is no active course available for analysis", async () => {
    dependencies.getLearningAnalyticsCourseOptions.mockResolvedValue([]);
    dependencies.getLessonAnalyticsMetrics.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await LearningAnalyticsPage({}));

    expect(markup).toContain("Nenhum Curso disponível para análise");
    expect(markup).toContain("publicação vigente");
    expect(dependencies.getLessonAnalyticsMetrics).not.toHaveBeenCalled();
  });
});
