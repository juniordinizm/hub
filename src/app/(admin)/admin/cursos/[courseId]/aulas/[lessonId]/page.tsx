import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toUploadAsset } from "@/features/admin/jmvstream-assets";
import { getAdminManagementData } from "@/features/admin/server";
import { parseLessonContent } from "@/features/courses/lesson-content";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { LessonEditorForm } from "../../course-builder-components";

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
  const hasVideo = Boolean(lesson.videoEmbedUrl || lesson.videoExternalId);
  const hasText = parseLessonContent(lesson.contentJson)?.type === "text";
  const hasAnyContent = hasVideo || hasText;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-muted-foreground text-sm">
            {course.title}
            {moduleData ? ` / ${moduleData.title}` : ""}
          </p>
          <h1 className="font-semibold text-2xl tracking-tight">
            {lesson.title}
          </h1>
          {lesson.description ? (
            <p className="text-muted-foreground">{lesson.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant={lesson.isPublished ? "default" : "outline"}>
            {lesson.isPublished ? "publicada" : "rascunho"}
          </Badge>
          {hasVideo ? <Badge variant="secondary">Video</Badge> : null}
          {hasText ? <Badge variant="secondary">Texto</Badge> : null}
          {hasAnyContent ? null : (
            <Badge variant="destructive">Sem conteúdo</Badge>
          )}
          <Badge variant="outline">
            {formatLessonDuration(lesson.durationSeconds)}
          </Badge>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <LessonEditorForm
          asset={asset ? toUploadAsset(asset) : undefined}
          lesson={lesson}
        />
      </section>
    </div>
  );
}
