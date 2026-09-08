"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useMemo } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  LessonCard,
  type LessonLockReason,
  type LessonStatus,
} from "@/components/ui/lesson-card";
import { Progress } from "@/components/ui/progress";
import type { LessonAvailability } from "@/features/courses/module-content-release";
import type { StudentPreviewMode } from "@/features/courses/preview";
import { getPreviewAwareHref } from "@/features/courses/preview";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";
import { APP_TIME_ZONE } from "@/lib/timezone";

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
  releaseState: "available" | "invalid" | "time_locked";
  sortOrder: number;
  title: string;
  totalDurationSeconds: number;
}

interface CourseOverviewClientProps {
  courseThumbnailUrl?: string | null;
  modules: ModuleData[];
  nextLessonId: string | null;
  previewMode: StudentPreviewMode | null;
}

export function CourseOverviewClient({
  courseThumbnailUrl,
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

  const totalLessonCount = modules.reduce(
    (total, moduleData) => total + moduleData.lessonCount,
    0
  );
  const visibleLessonCount = flatLessons.length;
  const lessonSummary =
    visibleLessonCount === totalLessonCount
      ? `${totalLessonCount} ${totalLessonCount === 1 ? "aula" : "aulas"}`
      : `${visibleLessonCount} ${visibleLessonCount === 1 ? "disponível" : "disponíveis"} de ${totalLessonCount} ${totalLessonCount === 1 ? "aula" : "aulas"}`;

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

  function getLessonLockReason(
    lesson: LessonData
  ): LessonLockReason | undefined {
    if (lesson.availability.kind === "time_locked") {
      return "time";
    }
    if (lesson.availability.kind === "sequence_locked") {
      return "sequence";
    }
    return;
  }

  const formatReleaseDate = (value: Date | null): string =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: APP_TIME_ZONE,
        }).format(new Date(value))
      : "após a confirmação do acesso";

  function renderLessonCard(lesson: LessonData) {
    const status = getLessonStatus(lesson);
    const lockReason =
      status === "locked" ? getLessonLockReason(lesson) : undefined;
    const hasOwnThumbnail = Boolean(lesson.thumbnailUrl);
    const card = (
      <LessonCard
        className="snap-start"
        durationText={formatLessonDuration(lesson.durationSeconds)}
        fallbackImageUrl={courseThumbnailUrl ?? null}
        hasVideo={lesson.hasVideo}
        key={lesson.id}
        {...(status === "locked" && lockReason ? { lockReason } : {})}
        status={status}
        thumbnailUnoptimized={Boolean(courseThumbnailUrl) && !hasOwnThumbnail}
        thumbnailUrl={lesson.thumbnailUrl ?? courseThumbnailUrl ?? null}
        title={lesson.title}
        watchedPercent={lesson.watchedPercent}
      />
    );

    if (status === "locked") {
      return (
        <div
          aria-disabled="true"
          className="cursor-default"
          data-locked="true"
          key={lesson.id}
        >
          {card}
        </div>
      );
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
            {lessonSummary}
          </p>
        </div>

        {modules.length === 0 ? (
          <Empty className="border border-dashed p-10">
            <EmptyHeader>
              <EmptyTitle as="h3">Nenhuma aula disponível</EmptyTitle>
              <EmptyDescription>
                O conteúdo deste curso ainda está sendo preparado. Volte mais
                tarde ou fale com o suporte se o acesso já deveria estar
                liberado.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col">
            {modules.map((moduleData, index) => {
              const completedCount = moduleData.lessons.filter(
                (l) => l.isCompleted
              ).length;
              const totalCount = moduleData.lessonCount;
              const progressPercent =
                totalCount > 0
                  ? Math.round((completedCount / totalCount) * 100)
                  : 0;
              const totalSeconds = moduleData.totalDurationSeconds;
              const isTimeLocked = moduleData.releaseState === "time_locked";
              let releaseDescription: string | null = null;
              if (moduleData.releaseState === "invalid") {
                releaseDescription =
                  "Disponibilidade temporariamente indisponível.";
              }

              return (
                <section
                  aria-describedby={
                    releaseDescription
                      ? `module-${moduleData.id}-release`
                      : undefined
                  }
                  aria-labelledby={`module-${moduleData.id}`}
                  className="flex flex-col"
                  data-release-state={moduleData.releaseState}
                  key={moduleData.id}
                >
                  <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                      <h3
                        className="font-bold text-wrap-balance text-xl"
                        id={`module-${moduleData.id}`}
                      >
                        {moduleData.title}
                      </h3>
                      {moduleData.description && (
                        <p className="mt-2 max-w-2xl text-muted-foreground text-sm text-wrap-pretty">
                          {moduleData.description}
                        </p>
                      )}
                      {releaseDescription ? (
                        <p
                          className="mt-2 flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums"
                          id={`module-${moduleData.id}-release`}
                        >
                          {releaseDescription}
                        </p>
                      ) : null}
                    </div>
                    {isTimeLocked ? (
                      <div className="flex shrink-0 flex-col items-start gap-0.5 text-muted-foreground text-sm md:items-end md:text-right">
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                          <HugeiconsIcon
                            aria-hidden="true"
                            className="shrink-0 text-warning"
                            icon={Clock01Icon}
                            size={17}
                            strokeWidth={2}
                          />
                          Em breve
                        </p>
                        <p className="tabular-nums">
                          {formatReleaseDate(moduleData.availableAt)}
                        </p>
                      </div>
                    ) : (
                      <div className="shrink-0 md:text-right">
                        <div className="mb-2 flex items-center gap-3 text-muted-foreground text-sm md:justify-end">
                          <span>{totalCount} aulas</span>
                          <span>&bull;</span>
                          <span>{formatLessonDuration(totalSeconds)}</span>
                        </div>
                        <div className="flex items-center gap-3 md:justify-end">
                          <Progress
                            aria-label={`Progresso do módulo ${moduleData.title}: ${progressPercent}%`}
                            className="h-2 w-32 bg-muted md:w-24"
                            value={progressPercent}
                          />
                          <span className="font-semibold text-xs">
                            {progressPercent}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="custom-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pt-2 pb-4">
                    {moduleData.lessons.length > 0 ? (
                      moduleData.lessons.map((lesson) =>
                        renderLessonCard(lesson)
                      )
                    ) : (
                      <p className="w-full rounded-lg border-2 border-border/50 border-dashed py-8 text-center text-muted-foreground text-sm">
                        Nenhuma aula cadastrada neste módulo.
                      </p>
                    )}
                  </div>

                  {index < modules.length - 1 && (
                    <hr className="my-8 border-border border-dashed" />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
