import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type LearningAnalyticsPeriod,
  parseLearningAnalyticsPeriod,
} from "@/features/learning-analytics/period";
import {
  buildLearningAnalyticsKpis,
  buildLessonAnalyticsLessonReports,
} from "@/features/learning-analytics/presentation";
import {
  getLearningAnalyticsCourseOptions,
  getLessonAnalyticsMetrics,
} from "@/features/learning-analytics/server";
import type { LearningAnalyticsCourseOption } from "@/features/learning-analytics/types";
import { LearningAnalyticsReport } from "./learning-analytics-report";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const getSelectedCourse = (
  courses: readonly LearningAnalyticsCourseOption[],
  requestedCourseId: string
): LearningAnalyticsCourseOption | null =>
  courses.find((course) => course.id === requestedCourseId) ??
  courses[0] ??
  null;

export default async function LearningAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}): Promise<React.JSX.Element> {
  const params = (await searchParams) ?? {};
  const requestedCourseId = firstSearchParam(params.courseId)?.trim() ?? "";
  const requestedPage = Number.parseInt(
    firstSearchParam(params.page) ?? "1",
    10
  );
  const period: LearningAnalyticsPeriod = parseLearningAnalyticsPeriod(
    firstSearchParam(params.period)
  );

  const courses = await getLearningAnalyticsCourseOptions();
  const selectedCourse = getSelectedCourse(courses, requestedCourseId);
  const rawMetrics = selectedCourse
    ? await getLessonAnalyticsMetrics({
        courseId: selectedCourse.id,
        period,
      })
    : [];
  const courseMetrics = selectedCourse
    ? rawMetrics.filter((metric) => metric.courseId === selectedCourse.id)
    : [];
  const lessons = buildLessonAnalyticsLessonReports(courseMetrics);
  const kpis = buildLearningAnalyticsKpis(lessons);
  const totalPages = Math.max(1, Math.ceil(lessons.length / PAGE_SIZE));
  const page = Number.isFinite(requestedPage)
    ? Math.min(totalPages, Math.max(1, requestedPage))
    : 1;
  const visibleLessons = lessons.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const exportHref = selectedCourse
    ? `/api/admin/learning-analytics/export?courseId=${encodeURIComponent(selectedCourse.id)}&period=${period}`
    : null;

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Entenda rapidamente o desempenho das Aulas e encontre pontos que merecem revisão."
          title="Aprendizagem"
        />

        {selectedCourse ? (
          <LearningAnalyticsReport
            course={selectedCourse}
            courses={courses}
            exportHref={exportHref ?? ""}
            kpis={kpis}
            lessons={visibleLessons}
            page={page}
            period={period}
            selectedCourseId={selectedCourse.id}
            totalLessonCount={lessons.length}
            totalPages={totalPages}
          />
        ) : (
          <Empty className="min-h-64 border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon aria-hidden="true" icon={BookOpen01Icon} />
              </EmptyMedia>
              <EmptyTitle as="h2">
                {requestedCourseId
                  ? "Curso não encontrado"
                  : "Nenhum Curso disponível para análise"}
              </EmptyTitle>
              <EmptyDescription>
                {requestedCourseId
                  ? "O Curso selecionado não está disponível para análise."
                  : "O relatório aparecerá quando existir um Curso ativo com uma publicação vigente e Aulas ativas."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </PageContainer>
  );
}
