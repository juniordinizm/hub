"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getLearningAnalyticsPeriodLabel,
  LEARNING_ANALYTICS_PERIODS,
  type LearningAnalyticsPeriod,
} from "@/features/learning-analytics/period";
import type { LearningAnalyticsCourseOption } from "@/features/learning-analytics/types";

export function LearningAnalyticsFilters({
  courses,
  period,
  selectedCourseId,
}: {
  courses: LearningAnalyticsCourseOption[];
  period: LearningAnalyticsPeriod;
  selectedCourseId: string | null;
}): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: "courseId" | "period", value: string): void => {
    const currentValue = key === "courseId" ? selectedCourseId : period;
    if (value === currentValue) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.set(key, value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid min-w-0 gap-1.5 sm:w-56">
        <label className="type-label" htmlFor="learning-course-select">
          Curso
        </label>
        <Select
          disabled={courses.length === 0 || isPending}
          onValueChange={(courseId) => updateFilter("courseId", courseId)}
          {...(selectedCourseId ? { value: selectedCourseId } : {})}
        >
          <SelectTrigger id="learning-course-select">
            <SelectValue placeholder="Selecione um Curso" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 gap-1.5 sm:w-44">
        <label className="type-label" htmlFor="learning-period-select">
          Período
        </label>
        <Select
          disabled={isPending}
          onValueChange={(nextPeriod) => updateFilter("period", nextPeriod)}
          value={period}
        >
          <SelectTrigger id="learning-period-select">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {LEARNING_ANALYTICS_PERIODS.map((periodOption) => (
              <SelectItem key={periodOption} value={periodOption}>
                {getLearningAnalyticsPeriodLabel(periodOption)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span aria-live="polite" className="sr-only">
        {isPending ? "Atualizando métricas…" : ""}
      </span>
    </div>
  );
}
