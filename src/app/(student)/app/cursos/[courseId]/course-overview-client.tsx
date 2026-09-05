"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LessonCard, type LessonStatus } from "@/components/ui/lesson-card";
import { Progress } from "@/components/ui/progress";
import type { LessonAvailability } from "@/features/courses/module-content-release";
import type { StudentPreviewMode } from "@/features/courses/preview";
import { getPreviewAwareHref } from "@/features/courses/preview";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

interface LessonData {
  availability: LessonAvailability;
  durationSeconds: number;
  hasVideo: boolean;
  id: string;
  isCompleted: boolean;
  thumbnailUrl?: string | null;
  title: string;
  watchedPercent: number;
}

interface ModuleData {
  availableAt: Date | null;
  description: string | null;
  id: string;
  lessonCount: number;
  lessons: LessonData[];
  releaseState: "available" | "time_locked";
  sortOrder: number;
  title: string;
  totalDurationSeconds: number;
}

interface CourseOverviewClientProps {
  modules: ModuleData[];
  nextLessonId: string | null;
  previewMode: StudentPreviewMode | null;
}

export function CourseOverviewClient({
  modules,
  nextLessonId,
  previewMode,
}: CourseOverviewClientProps): React.JSX.Element {
  const flatLessons = useMemo(
    () => modules.flatMap((m) => m.lessons),
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

    const lessons: LessonData[] = [];
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
    if (lesson.availability.kind !== "available") {
      return "locked";
    }
    if (lesson.id === nextLessonId) {
      return "next";
    }
    return "available";
  }

  const formatReleaseDate = (value: Date | null): string =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value))
      : "após a confirmação do acesso";

  function renderLessonCard(lesson: LessonData) {
    const status = getLessonStatus(lesson);
    const card = (
      <LessonCard
        className="snap-start"
        durationText={formatLessonDuration(lesson.durationSeconds)}
        hasVideo={lesson.hasVideo}
        key={lesson.id}
        status={status}
        thumbnailUrl={lesson.thumbnailUrl ?? null}
        title={lesson.title}
        watchedPercent={lesson.watchedPercent}
      />
    );

    if (status === "locked") {
      return <div key={lesson.id}>{card}</div>;
    }

    return (
      <Link
        href={route(
          getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode)
        )}
        key={lesson.id}
      >
        {card}
      </Link>
    );
  }

  return (
    <>
      {continueWatchingLessons.length > 0 && (
        <section className="mt-8 rounded-xl border border-border/50 bg-muted/20 px-6 pt-4">
          <div>
            <h2 className="font-bold text-xl tracking-tight">
              {previewMode ? "Preview da trilha" : "Continuar assistindo"}
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {previewMode
                ? "Todas as aulas aparecem liberadas para revisão do admin."
                : "Retome de onde você parou."}
            </p>
          </div>

          <div className="custom-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {continueWatchingLessons.map(renderLessonCard)}
          </div>
        </section>
      )}

      <section className="pt-9">
        <div className="mb-10">
          <h2 className="font-bold text-2xl tracking-tight">Trilha do curso</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {modules.length} {modules.length === 1 ? "módulo" : "módulos"} ·{" "}
            {flatLessons.length} {flatLessons.length === 1 ? "aula" : "aulas"}
          </p>
        </div>

        <div className="flex flex-col">
          {modules.map((moduleData, index) => {
            if (moduleData.releaseState === "time_locked") {
              return (
                <section
                  aria-labelledby={`module-${moduleData.id}`}
                  className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-5"
                  key={moduleData.id}
                >
                  <h3
                    className="font-bold text-xl"
                    id={`module-${moduleData.id}`}
                  >
                    {moduleData.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Disponível em {formatReleaseDate(moduleData.availableAt)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {moduleData.lessonCount}{" "}
                    {moduleData.lessonCount === 1 ? "aula" : "aulas"}
                  </p>
                </section>
              );
            }
            const completedCount = moduleData.lessons.filter(
              (l) => l.isCompleted
            ).length;
            const totalCount = moduleData.lessonCount;
            const progressPercent =
              totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0;
            const totalSeconds = moduleData.totalDurationSeconds;

            return (
              <div className="flex flex-col" key={moduleData.id}>
                <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <h3 className="font-bold text-xl">{moduleData.title}</h3>
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
                    moduleData.lessons.map((lesson) => renderLessonCard(lesson))
                  ) : (
                    <p className="w-full rounded-lg border-2 border-border/50 border-dashed py-8 text-center text-muted-foreground text-sm">
                      Nenhuma aula cadastrada neste módulo.
                    </p>
                  )}
                </div>

                {index < modules.length - 1 && (
                  <hr className="my-8 border-border border-dashed" />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
