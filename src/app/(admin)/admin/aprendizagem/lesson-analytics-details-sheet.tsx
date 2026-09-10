"use client";

import { Clock01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getLearningAnalyticsPeriodLabel,
  type LearningAnalyticsPeriod,
} from "@/features/learning-analytics/period";
import {
  formatLearningAnalyticsHours,
  formatLearningAnalyticsPercent,
} from "@/features/learning-analytics/presentation";
import type {
  LessonAnalyticsLessonReport,
  LessonAnalyticsPublicationStatus,
  LessonAnalyticsVersionMetric,
} from "@/features/learning-analytics/types";

const PUBLICATION_PRESENTATION: Record<
  LessonAnalyticsPublicationStatus,
  { label: string; variant: "outline" | "secondary" | "success" | "warning" }
> = {
  draft: { label: "Rascunho", variant: "warning" },
  published: { label: "Publicada", variant: "success" },
  retired: { label: "Retirada", variant: "secondary" },
};

const VERSION_METRIC_COLUMNS: ReadonlyArray<{
  abbreviation: string;
  getValue: (metric: LessonAnalyticsVersionMetric) => string;
  label: string;
}> = [
  {
    abbreviation: "MA",
    getValue: (metric) => String(metric.activeEnrollments),
    label: "Matrículas ativas",
  },
  {
    abbreviation: "I",
    getValue: (metric) => String(metric.started),
    label: "Iniciaram",
  },
  {
    abbreviation: "C",
    getValue: (metric) => String(metric.completed),
    label: "Concluíram",
  },
  {
    abbreviation: "CM",
    getValue: (metric) =>
      formatLearningAnalyticsPercent(metric.medianCheckpointPercent),
    label: "Checkpoint mediano",
  },
  {
    abbreviation: "TC",
    getValue: (metric) =>
      formatLearningAnalyticsHours(metric.medianHoursToComplete),
    label: "Tempo mediano até concluir",
  },
  {
    abbreviation: "TP",
    getValue: (metric) =>
      formatLearningAnalyticsHours(metric.medianHoursToNextLesson),
    label: "Tempo mediano até próxima Aula",
  },
  {
    abbreviation: "E",
    getValue: (metric) => String(metric.errorCount),
    label: "Erros",
  },
];

function VersionMetricHeader({
  abbreviation,
  label,
}: {
  abbreviation: string;
  label: string;
}): React.JSX.Element {
  return (
    <TableHead className="px-1 text-right text-[11px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <abbr className="cursor-help font-medium no-underline" title={label}>
            {abbreviation}
          </abbr>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

function VersionMetricsTable({
  lessonTitle,
  versions,
}: {
  lessonTitle: string;
  versions: readonly LessonAnalyticsVersionMetric[];
}): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={250}>
      <div className="max-w-full overflow-hidden rounded-lg border">
        <Table className="w-full table-fixed text-[11px]">
          <TableCaption className="sr-only">
            Métricas da Aula {lessonTitle} por versão
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap px-1 text-[11px]">
                Versão
              </TableHead>
              <TableHead className="whitespace-nowrap px-1 text-[11px]">
                Status
              </TableHead>
              {VERSION_METRIC_COLUMNS.map((column) => (
                <VersionMetricHeader
                  abbreviation={column.abbreviation}
                  key={column.abbreviation}
                  label={column.label}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((metric) => {
              const presentation =
                PUBLICATION_PRESENTATION[metric.publicationStatus];

              return (
                <TableRow
                  key={`${metric.publicationNumber}-${metric.publicationStatus}`}
                >
                  <TableRowHeader className="whitespace-nowrap px-1">
                    v{metric.publicationNumber}
                  </TableRowHeader>
                  <TableCell className="px-1 text-center">
                    <Badge
                      className="whitespace-normal px-1 text-center text-[10px]"
                      variant={presentation.variant}
                    >
                      {presentation.label}
                    </Badge>
                  </TableCell>
                  {VERSION_METRIC_COLUMNS.map((column) => (
                    <TableCell
                      className="px-1 text-right tabular-nums"
                      key={column.abbreviation}
                    >
                      {column.getValue(metric)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

export function LessonAnalyticsDetailsSheet({
  lesson,
  period,
}: {
  lesson: LessonAnalyticsLessonReport;
  period: LearningAnalyticsPeriod;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const currentVersion = lesson.current.publicationNumber;
  const periodLabel = getLearningAnalyticsPeriodLabel(period);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label={`Ver versões da Aula ${lesson.position}: ${lesson.lessonTitle}`}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={ViewIcon}
            size={16}
            strokeWidth={2}
          />
          <span>{lesson.versions.length > 1 ? "Ver versões" : "Detalhes"}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl"
        side="right"
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle className="text-lg">
            Aula {lesson.position}: {lesson.lessonTitle}
          </SheetTitle>
          <SheetDescription>
            {lesson.moduleTitle} · Publicação vigente v{currentVersion} ·{" "}
            {periodLabel}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 min-w-0 flex-1 overscroll-contain p-6">
          <div className="grid min-w-0 gap-4">
            <section
              aria-labelledby={`lesson-history-${lesson.curriculumKey}`}
              className="min-w-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="text-muted-foreground"
                    icon={Clock01Icon}
                    size={18}
                    strokeWidth={2}
                  />
                  <h2
                    className="font-medium text-sm"
                    id={`lesson-history-${lesson.curriculumKey}`}
                  >
                    Versões da Aula
                  </h2>
                </div>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {lesson.versions.length === 1
                    ? "1 versão"
                    : `${lesson.versions.length} versões`}
                </span>
              </div>
              <p className="mt-2 max-w-full break-words text-muted-foreground text-sm">
                Publicada é a versão vigente. Passe o cursor sobre as siglas
                para ver o nome completo da métrica. O período selecionado é{" "}
                {periodLabel.toLowerCase()}.
              </p>
              <div className="mt-4">
                <VersionMetricsTable
                  lessonTitle={lesson.lessonTitle}
                  versions={lesson.versions}
                />
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
