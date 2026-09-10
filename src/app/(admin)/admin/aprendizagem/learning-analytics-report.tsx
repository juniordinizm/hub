import {
  Alert02Icon,
  Analytics01Icon,
  BookOpen01Icon,
  Download01Icon,
  MoreHorizontalIcon,
  PlayCircle02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AdminMetricCard } from "@/app/(admin)/admin/admin-metric-card";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { LearningAnalyticsPeriod } from "@/features/learning-analytics/period";
import { getLearningAnalyticsPeriodLabel } from "@/features/learning-analytics/period";
import {
  formatLearningAnalyticsHours,
  formatLearningAnalyticsPercent,
} from "@/features/learning-analytics/presentation";
import type {
  LearningAnalyticsCourseOption,
  LearningAnalyticsKpis,
  LessonAnalyticsLessonReport,
} from "@/features/learning-analytics/types";
import { route } from "@/lib/routes";
import { LearningAnalyticsFilters } from "./learning-analytics-filters";
import { LessonAnalyticsDetailsSheet } from "./lesson-analytics-details-sheet";

const getCoursePageHref = (
  courseId: string,
  period: LearningAnalyticsPeriod,
  page: number
): string => {
  const params = new URLSearchParams({ courseId, period });
  if (page > 1) {
    params.set("page", String(page));
  }
  return route(`/admin/aprendizagem?${params.toString()}`);
};

const formatLessonPosition = (position: number): string =>
  String(position).padStart(2, "0");

function LearningAnalyticsMoreActions({
  exportHref,
}: {
  exportHref: string;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Mais opções do relatório de aprendizagem"
          size="icon"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={MoreHorizontalIcon}
            size={18}
            strokeWidth={2}
          />
          <span className="sr-only">Mais opções</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={exportHref}>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Download01Icon}
              size={16}
              strokeWidth={2}
            />
            Exportar dados
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LearningAnalyticsKpisSection({
  kpis,
}: {
  kpis: LearningAnalyticsKpis;
}): React.JSX.Element {
  const courseViewingValue = kpis.averageCourseViewingPercent;
  const courseViewingLabel = formatLearningAnalyticsPercent(courseViewingValue);
  const courseViewingProgress =
    courseViewingValue === null
      ? null
      : {
          ariaLabel: `Visualização média do Curso: ${courseViewingLabel}`,
          value: courseViewingValue,
        };

  return (
    <section aria-labelledby="learning-report-heading">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          helper="Aulas ativas na publicação vigente."
          icon={BookOpen01Icon}
          label="Aulas no Curso"
          value={String(kpis.lessonCount)}
        />
        <AdminMetricCard
          helper="Aulas com falha no período selecionado."
          icon={Alert02Icon}
          label="Aulas com erro"
          value={String(kpis.lessonsWithErrors)}
        />
        <AdminMetricCard
          helper="Sem início no período selecionado."
          icon={PlayCircle02Icon}
          label="Aulas sem início"
          value={String(kpis.lessonsWithoutStarts)}
        />
        <AdminMetricCard
          helper="Média de visualização do curso por aluno"
          icon={ViewIcon}
          label="Visualização média do Curso"
          value={courseViewingLabel}
          {...(courseViewingProgress
            ? { progress: courseViewingProgress }
            : {})}
        />
      </div>
    </section>
  );
}

function LearningAnalyticsLessonsTable({
  course,
  lessons,
  page,
  period,
  totalLessonCount,
  totalPages,
}: {
  course: LearningAnalyticsCourseOption;
  lessons: LessonAnalyticsLessonReport[];
  page: number;
  period: LearningAnalyticsPeriod;
  totalLessonCount: number;
  totalPages: number;
}): React.JSX.Element {
  return (
    <>
      <div className="rounded-lg border">
        <Table className="min-w-[900px]">
          <TableCaption className="sr-only">
            Desempenho das Aulas do Curso {course.title}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Ordem</TableHead>
              <TableHead>Aula</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Iniciaram
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Concluíram
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Checkpoint
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Erros
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Até concluir
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Até próxima Aula
              </TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length > 0 ? (
              lessons.map((lesson) => (
                <TableRow key={lesson.curriculumKey}>
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    Aula {formatLessonPosition(lesson.position)}
                  </TableCell>
                  <TableRowHeader>
                    <div className="min-w-48">
                      <p className="font-medium text-sm">
                        {lesson.lessonTitle}
                      </p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        {lesson.moduleTitle}
                      </p>
                    </div>
                  </TableRowHeader>
                  <TableCell className="text-right tabular-nums">
                    {lesson.aggregate.started}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lesson.aggregate.completed}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsPercent(
                      lesson.aggregate.medianCheckpointPercent
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lesson.aggregate.errorCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsHours(
                      lesson.aggregate.medianHoursToComplete
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsHours(
                      lesson.aggregate.medianHoursToNextLesson
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <LessonAnalyticsDetailsSheet
                      lesson={lesson}
                      period={period}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-56 p-0" colSpan={9}>
                  <Empty className="rounded-none border-0 p-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={Analytics01Icon}
                        />
                      </EmptyMedia>
                      <EmptyTitle as="h3">
                        Nenhuma Aula na publicação vigente
                      </EmptyTitle>
                      <EmptyDescription>
                        Publique ou ative as Aulas do Curso para começar a
                        acompanhar o relatório.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalLessonCount > 0 && (page > 1 || page < totalPages) ? (
        <div className="mt-4 flex justify-end">
          <nav
            aria-label="Paginação do relatório de aprendizagem"
            className="flex gap-2"
          >
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <a href={getCoursePageHref(course.id, period, page - 1)}>
                  Anterior
                </a>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild size="sm" variant="outline">
                <a href={getCoursePageHref(course.id, period, page + 1)}>
                  Próxima
                </a>
              </Button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}

export function LearningAnalyticsReport({
  course,
  courses,
  exportHref,
  kpis,
  lessons,
  page,
  period,
  selectedCourseId,
  totalLessonCount,
  totalPages,
}: {
  course: LearningAnalyticsCourseOption;
  courses: LearningAnalyticsCourseOption[];
  exportHref: string;
  kpis: LearningAnalyticsKpis;
  lessons: LessonAnalyticsLessonReport[];
  page: number;
  period: LearningAnalyticsPeriod;
  selectedCourseId: string;
  totalLessonCount: number;
  totalPages: number;
}): React.JSX.Element {
  return (
    <>
      <section aria-labelledby="learning-report-heading">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="type-section-title" id="learning-report-heading">
                Visão rápida
              </h2>
              <FinanceHelp
                description="Use o resumo e a tabela para identificar Aulas que precisam de revisão e acompanhar o efeito das versões publicadas."
                details={[
                  "Inícios, conclusões e erros são somados entre todas as versões da mesma Aula.",
                  "Visualização média do Curso considera cada Aula ativa: conclusão vale 100%, ausência de registro vale 0% e o maior checkpoint da versão assistida entra no cálculo.",
                  "Checkpoint e tempos são medianas calculadas sobre os registros disponíveis no período selecionado. Eventos brutos ficam disponíveis por até 12 meses.",
                  "Abra Detalhes para comparar cada versão e seu status. Dados de Alunos, Contas e e-mails não aparecem aqui.",
                ]}
                title="Como ler o relatório de aprendizagem"
              />
            </div>
            <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
              {course.title} · Contagens em{" "}
              {getLearningAnalyticsPeriodLabel(period)}. A tabela lista as Aulas
              na ordem do Curso.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <LearningAnalyticsFilters
              courses={courses}
              period={period}
              selectedCourseId={selectedCourseId}
            />
            <LearningAnalyticsMoreActions exportHref={exportHref} />
          </div>
        </div>
      </section>
      <LearningAnalyticsKpisSection kpis={kpis} />
      <LearningAnalyticsLessonsTable
        course={course}
        lessons={lessons}
        page={page}
        period={period}
        totalLessonCount={totalLessonCount}
        totalPages={totalPages}
      />
    </>
  );
}
