"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LessonSidebarHeaderProps {
  courseTitle: string;
  formId: string;
  lesson: { status?: string | null; title: string };
  moduleTitle?: string | undefined;
}

export function LessonSidebarHeader({
  courseTitle,
  formId,
  lesson,
  moduleTitle,
}: LessonSidebarHeaderProps): React.JSX.Element {
  const [status, setStatus] = useState(lesson.status ?? "draft");

  return (
    <div className="flex shrink-0 flex-col gap-5 border-b px-5 py-5">
      <div className="min-w-0">
        <p className="font-medium text-muted-foreground text-sm">
          {courseTitle}
          {moduleTitle ? ` / ${moduleTitle}` : ""}
        </p>
        <h1 className="mt-1 font-semibold text-xl tracking-tight">
          {lesson.title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Hidden input for form submission via form attribute */}
        <input form={formId} name="status" type="hidden" value={status} />

        <Select onValueChange={setStatus} value={status}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Publicada</SelectItem>
            <SelectItem value="archived">Arquivada</SelectItem>
          </SelectContent>
        </Select>

        <Button className="flex-1" form={formId} type="submit">
          <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
          Salvar aula
        </Button>
      </div>
    </div>
  );
}
