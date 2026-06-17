"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LessonCard, type LessonStatus } from "@/components/ui/lesson-card";
import { Progress } from "@/components/ui/progress";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

interface LessonData {
  durationSeconds: number;
  id: string;
  isAvailable: boolean;
  isCompleted: boolean;
  lessonType: string;
  thumbnailUrl?: string | null;
  title: string;
}

interface ModuleData {
  description: string | null;
  id: string;
  lessons: LessonData[];
  sortOrder: number;
  title: string;
}

interface CourseOverviewClientProps {
  modules: ModuleData[];
  nextLessonId: string | null;
}

export function CourseOverviewClient({
  modules,
  nextLessonId,
}: CourseOverviewClientProps): React.JSX.Element {
  const flatLessons = useMemo(
    () =>
      modules.flatMap((m) =>
        m.lessons.map((l) => ({ ...l, moduleName: `Módulo ${m.sortOrder}` }))
      ),
    [modules]
  );

  const continueWatchingLessons = useMemo(() => {
    if (!nextLessonId) {
      return [];
    }
    const index = flatLessons.findIndex((l) => l.id === nextLessonId);
    if (index === -1) {
      return [];
    }

    const lessons: (LessonData & { moduleName: string })[] = [];
    const current = flatLessons[index];
    if (current) {
      lessons.push(current);
    }

    const next = flatLessons[index + 1];
    if (next) {
      lessons.push(next);
    }

    return lessons;
  }, [flatLessons, nextLessonId]);

  function getLessonStatus(lesson: LessonData): LessonStatus {
    if (lesson.isCompleted) {
      return "completed";
    }
    if (!lesson.isAvailable) {
      return "locked";
    }
    if (lesson.id === nextLessonId) {
      return "next";
    }
    return "available";
  }

  function renderLessonCard(lesson: LessonData & { moduleName: string }) {
    const status = getLessonStatus(lesson);
    const card = (
      <LessonCard
        className="snap-start"
        durationText={formatLessonDuration(lesson.durationSeconds)}
        key={lesson.id}
        moduleName={lesson.moduleName}
        status={status}
        thumbnailUrl={lesson.thumbnailUrl ?? null}
        title={lesson.title}
      />
    );

    if (status === "locked") {
      return <div key={lesson.id}>{card}</div>;
    }

    return (
      <Link href={route(`/app/aulas/${lesson.id}`)} key={lesson.id}>
        {card}
      </Link>
    );
  }

  return (
    <>
      {continueWatchingLessons.length > 0 && (
        <section className="border-border/50 border-b bg-muted/20 px-6 pt-9 pb-6 sm:px-10 lg:px-12">
          <div>
            <h2 className="font-bold text-xl tracking-tight">
              Continuar assistindo
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Retome de onde você parou
            </p>
          </div>

          <div className="custom-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {continueWatchingLessons.map(renderLessonCard)}
          </div>
        </section>
      )}

      <section className="px-6 py-9 sm:px-10 lg:px-12">
        <div className="mb-10">
          <h2 className="font-bold text-2xl tracking-tight">
            Conteúdo do Curso
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {modules.length} {modules.length === 1 ? "módulo" : "módulos"} ·{" "}
            {flatLessons.length} {flatLessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>

        <div className="flex flex-col gap-12">
          {modules.map((moduleData) => {
            const completedCount = moduleData.lessons.filter(
              (l) => l.isCompleted
            ).length;
            const totalCount = moduleData.lessons.length;
            const progressPercent =
              totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0;
            const totalSeconds = moduleData.lessons.reduce(
              (acc, l) => acc + l.durationSeconds,
              0
            );

            return (
              <div className="flex flex-col" key={moduleData.id}>
                <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <h3 className="mb-1 font-semibold text-foreground text-lg text-muted-foreground text-sm uppercase tracking-wider">
                      Módulo {moduleData.sortOrder}
                    </h3>
                    <h4 className="font-bold text-xl">{moduleData.title}</h4>
                    {moduleData.description && (
                      <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                        {moduleData.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 md:text-right">
                    <div className="mb-2 flex items-center gap-3 text-muted-foreground text-sm md:justify-end">
                      <span>{totalCount} aulas</span>
                      <span>&bull;</span>
                      <span>{formatLessonDuration(totalSeconds)}</span>
                    </div>
                    <div className="flex items-center gap-3 md:justify-end">
                      <Progress
                        className="h-2 w-32 bg-muted md:w-24"
                        value={progressPercent}
                      />
                      <span className="font-semibold text-xs">
                        {progressPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="custom-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pt-2 pb-4">
                  {moduleData.lessons.length > 0 ? (
                    moduleData.lessons.map((lesson) =>
                      renderLessonCard({
                        ...lesson,
                        moduleName: `Módulo ${moduleData.sortOrder}`,
                      })
                    )
                  ) : (
                    <p className="w-full rounded-lg border-2 border-border/50 border-dashed py-8 text-center text-muted-foreground text-sm">
                      Nenhuma aula cadastrada neste módulo.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
