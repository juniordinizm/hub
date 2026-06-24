import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { LessonCommentsSection } from "@/components/lesson-comments-section";
import { LessonResourcesFields } from "@/components/lesson-kind-controls";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveLessonAction } from "@/features/admin/actions";
import { toUploadAsset } from "@/features/admin/jmvstream-assets";
import { getAdminManagementData } from "@/features/admin/server";
import { getLessonComments } from "@/features/comments/server";
import type { LessonResource } from "@/features/courses/lesson-content";
import { parseLessonContent } from "@/features/courses/lesson-content";
import { requireRole } from "@/lib/session";
import { LessonEditorForm } from "../../course-builder-components";

export const dynamic = "force-dynamic";

const LESSON_EDITOR_FORM_ID = "lesson-editor-form";

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
  const [data, session] = await Promise.all([
    getAdminManagementData(),
    requireRole(["admin", "support"]),
  ]);
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

  const commentsData = await getLessonComments({
    lessonId: lesson.id,
    role: session.role,
    userId: session.user.id,
  });

  const defaultResources = getDefaultResources(lesson.contentJson);

  return (
    <div className="grid grid-cols-1 lg:h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Coluna principal */}
      <div className="custom-scrollbar lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-5 pt-10 pb-10">
          <form
            action={saveLessonAction}
            className="space-y-6"
            id={LESSON_EDITOR_FORM_ID}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
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
                <Select defaultValue={lesson.status ?? "draft"} name="status">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Publicada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit">
                  <HugeiconsIcon
                    icon={FloppyDiskIcon}
                    size={18}
                    strokeWidth={2}
                  />
                  Salvar aula
                </Button>
              </div>
            </div>

            <LessonEditorForm
              asset={asset ? toUploadAsset(asset) : undefined}
              lesson={lesson}
            />
          </form>

          <LessonCommentsSection
            canComment
            canModerate
            comments={commentsData.comments}
            context="admin"
            lessonId={lesson.id}
            totalCount={commentsData.totalCount}
          />
        </div>
      </div>

      {/* Sidebar de materiais */}
      <aside className="hidden border-l lg:flex lg:flex-col">
        <div className="shrink-0 border-b px-5 py-5">
          <p className="font-semibold text-sm">Anexos da aula</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Materiais complementares e recursos para download
          </p>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <LessonResourcesFields
            defaultResources={defaultResources}
            formId={LESSON_EDITOR_FORM_ID}
            lessonId={lesson.id}
          />
        </div>
      </aside>
    </div>
  );
}

function getDefaultResources(contentJson: unknown): LessonResource[] {
  const content = parseLessonContent(contentJson);

  if (content?.type === "text" && "resources" in content) {
    return content.resources ?? [];
  }

  return [];
}
