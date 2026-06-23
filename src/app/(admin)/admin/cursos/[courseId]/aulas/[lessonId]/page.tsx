import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { saveLessonAction } from "@/features/admin/actions";
import { toUploadAsset } from "@/features/admin/jmvstream-assets";
import { getAdminManagementData } from "@/features/admin/server";
import {
  DeleteLessonDialog,
  LessonEditorForm,
} from "../../course-builder-components";

export const dynamic = "force-dynamic";

interface AdminLessonEditPageProps {
  params: Promise<{
    courseId: string;
    lessonId: string;
  }>;
}

export default async function AdminLessonEditPage({
  params,
}: AdminLessonEditPageProps): Promise<React.JSX.Element> {
  const { courseId, lessonId } = await params;
  const data = await getAdminManagementData();
  const course = data.courses.find((item) => item.id === courseId);

  if (!course) {
    notFound();
  }

  const moduleIds = new Set(
    data.modules
      .filter((moduleData) => moduleData.courseId === course.id)
      .map((moduleData) => moduleData.id)
  );
  const lesson = data.lessons.find(
    (item) => item.id === lessonId && moduleIds.has(item.moduleId)
  );

  if (!lesson) {
    notFound();
  }

  const moduleData = data.modules.find((item) => item.id === lesson.moduleId);
  const asset = data.jmvstreamAssets.find(
    (item) => item.lessonId === lesson.id
  );

  const publishedFieldId = `lesson-is-published-${lesson.id}`;

  return (
    <form action={saveLessonAction} className="space-y-6">
      <div className="flex flex-col gap-6 rounded-lg border bg-card p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-muted-foreground text-sm">
            {course.title}
            {moduleData ? ` / ${moduleData.title}` : ""}
          </p>
          <h1 className="font-semibold text-2xl tracking-tight">
            {lesson.title}
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 lg:justify-end">
          <label
            className="inline-flex cursor-pointer items-center gap-2 font-medium text-sm"
            htmlFor={publishedFieldId}
          >
            <Checkbox
              defaultChecked={lesson.isPublished}
              id={publishedFieldId}
              name="isPublished"
            />
            Publicada
          </label>
          <div className="h-6 w-px bg-border/50" />
          <DeleteLessonDialog lesson={lesson} />
          <Button type="submit">
            <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
            Salvar aula
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <LessonEditorForm
          asset={asset ? toUploadAsset(asset) : undefined}
          lesson={lesson}
        />
      </section>
    </form>
  );
}
