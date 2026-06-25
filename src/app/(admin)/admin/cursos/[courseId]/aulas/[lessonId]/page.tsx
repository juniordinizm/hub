import { notFound } from "next/navigation";
import { LessonCommentsSection } from "@/components/lesson-comments-section";
import {
  LessonResourcesFields,
  LessonVideoControls,
} from "@/components/lesson-kind-controls";
import { LessonRichTextEditor } from "@/components/lesson-rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveLessonAction } from "@/features/admin/actions";
import { toUploadAsset } from "@/features/admin/jmvstream-assets";
import { getAdminManagementData } from "@/features/admin/server";
import { getLessonComments } from "@/features/comments/server";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  EMPTY_TEXT_DOCUMENT,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import { requireRole } from "@/lib/session";
import { LessonEditorSidebarFields } from "../../course-builder-components";
import { LessonSidebarActions } from "./lesson-sidebar-actions";
import { LessonSidebarDuration } from "./lesson-sidebar-duration";

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
  const asset = lesson.videoExternalId
    ? data.jmvstreamAssets.find(
        (item) =>
          item.lessonId === lesson.id &&
          item.videoHash === lesson.videoExternalId
      )
    : undefined;

  const commentsData = await getLessonComments({
    lessonId: lesson.id,
    role: session.role,
    userId: session.user.id,
  });

  const defaultResources = getDefaultResources(lesson.contentJson);
  const parsedContent = parseLessonContent(lesson.contentJson);

  return (
    <div className="flex w-full max-w-[100vw] flex-col overflow-x-hidden lg:grid lg:h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Coluna principal com Abas */}
      <div className="custom-scrollbar bg-muted/20 max-lg:contents lg:flex lg:flex-col lg:overflow-y-auto">
        <div className="order-4 mx-auto w-full max-w-5xl px-4 py-6 lg:order-none lg:px-8 lg:py-10">
          <Tabs className="w-full" defaultValue="video">
            <div className="mb-8 pb-1">
              <TabsList className="!h-auto grid w-full grid-cols-2 gap-1 p-1 sm:flex">
                <TabsTrigger className="flex-1 py-1.5" value="video">
                  Vídeo
                </TabsTrigger>
                <TabsTrigger className="flex-1 py-1.5" value="text">
                  Texto
                </TabsTrigger>
                <TabsTrigger className="flex-1 py-1.5" value="attachments">
                  Anexos
                  {defaultResources.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
                      {defaultResources.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger className="flex-1 py-1.5" value="comments">
                  Comentários
                  {commentsData.totalCount > 0 && (
                    <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
                      {commentsData.totalCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <form action={saveLessonAction} id={LESSON_EDITOR_FORM_ID}>
              <TabsContent
                className="m-0 border-none p-0 focus-visible:ring-0 data-[state=inactive]:hidden"
                forceMount
                value="video"
              >
                <LessonVideoControls
                  asset={asset ? toUploadAsset(asset) : undefined}
                  defaultEmbedUrl={lesson.videoEmbedUrl ?? ""}
                  defaultOrder={lesson.sortOrder}
                  defaultTitle={lesson.title}
                  defaultVideoDurationSeconds={lesson.videoDurationSeconds}
                  defaultVideoExternalId={lesson.videoExternalId}
                  lessonId={lesson.id}
                />
              </TabsContent>

              <TabsContent
                className="m-0 border-none p-0 focus-visible:ring-0 data-[state=inactive]:hidden"
                forceMount
                value="text"
              >
                <LessonRichTextEditor
                  initialDocument={
                    parsedContent?.type === "text"
                      ? parsedContent.document
                      : EMPTY_TEXT_DOCUMENT
                  }
                />
              </TabsContent>

              <TabsContent
                className="m-0 border-none p-0 focus-visible:ring-0"
                value="attachments"
              >
                <LessonResourcesFields
                  defaultResources={defaultResources}
                  formId={LESSON_EDITOR_FORM_ID}
                  lessonId={lesson.id}
                />
              </TabsContent>
            </form>

            <TabsContent
              className="m-0 border-none p-0 focus-visible:ring-0"
              value="comments"
            >
              <LessonCommentsSection
                canComment
                canModerate
                comments={commentsData.comments}
                context="admin"
                lessonId={lesson.id}
                totalCount={commentsData.totalCount}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Sidebar de materiais e ações */}
      <aside className="bg-background max-lg:contents lg:flex lg:flex-col lg:border-l">
        {/* Header da Aula no Sidebar com Duração */}
        <div className="order-1 shrink-0 space-y-5 px-4 pt-4 pb-4 lg:order-none lg:border-b lg:px-5 lg:py-5">
          <div className="min-w-0">
            <p className="truncate font-medium text-muted-foreground text-sm">
              {course.title}
              {moduleData ? ` / ${moduleData.title}` : ""}
            </p>
            <h1 className="mt-1 font-semibold text-xl tracking-tight">
              {lesson.title}
            </h1>
          </div>

          <LessonSidebarDuration
            durationSeconds={lesson.durationSeconds}
            textDurationSeconds={lesson.textDurationSeconds}
            videoDurationSeconds={lesson.videoDurationSeconds}
          />
        </div>

        {/* Formulário de Metadados (Título e Descrição) */}
        <div className="custom-scrollbar order-3 flex-1 px-4 py-6 lg:order-none lg:overflow-y-auto lg:py-6 lg:pb-20">
          <LessonEditorSidebarFields
            formId={LESSON_EDITOR_FORM_ID}
            lesson={lesson}
          />
        </div>

        {/* Rodapé Fixo de Ações */}
        <div className="sticky top-0 z-10 order-2 shrink-0 border-b bg-background px-4 pt-2 pb-5 lg:static lg:mt-auto lg:border-t lg:border-b-0 lg:px-5 lg:py-5">
          <LessonSidebarActions
            formId={LESSON_EDITOR_FORM_ID}
            initialStatus={lesson.status ?? "draft"}
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
