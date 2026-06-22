import {
  ArrowRight01Icon,
  Maximize01Icon,
  Minimize01Icon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { completeLessonAction } from "@/app/(student)/app/actions";
import { LessonRichTextRenderer } from "@/components/lesson-rich-text-renderer";
import { LessonVideoPlayer } from "@/components/lesson-video-player";
import { RegisterPreviewCourseId } from "@/components/panel-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import {
  createTextDocumentFromPlainText,
  type LessonResource,
} from "@/features/courses/lesson-content";
import {
  canAccessStudentRoute,
  getHrefWithSearchParams,
  getPreviewAwareHref,
  getStudentPreviewMode,
  type StudentPreviewMode,
} from "@/features/courses/preview";
import {
  getPreviewLessonData,
  getStudentLessonData,
} from "@/features/courses/server";
import {
  formatLessonDuration,
  resolveLessonVideoEmbedUrl,
  toVideoProvider,
} from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LessonPageData = NonNullable<
  Awaited<ReturnType<typeof getStudentLessonData>>
>;
interface LessonSearchParams {
  busca?: string;
  focus?: string;
  preview?: string | string[];
}
interface LessonWithModule {
  id: string;
  moduleTitle: string;
  title: string;
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<LessonSearchParams>;
}): Promise<React.JSX.Element> {
  const [{ lessonId }, query, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const previewMode = getStudentPreviewMode({
    preview: query.preview,
    role: session.role,
  });

  if (
    !canAccessStudentRoute({
      pathname: `/app/aulas/${lessonId}`,
      previewMode,
      role: session.role,
    })
  ) {
    redirect(route("/admin"));
  }

  const data = previewMode
    ? await getPreviewLessonData({ lessonId })
    : await getStudentLessonData({
        userId: session.user.id,
        lessonId,
      });

  if (!data) {
    notFound();
  }

  const lessonView = getLessonViewState({
    data,
    query,
    previewMode,
  });

  return (
    <div
      className={cn(
        "grid bg-background text-foreground",
        lessonView.isFocusMode
          ? "grid-cols-1"
          : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]"
      )}
    >
      <section className="min-w-0">
        {previewMode ? (
          <RegisterPreviewCourseId courseId={data.course.id} />
        ) : null}

        <LessonMainContent
          data={data}
          lessonView={lessonView}
          previewMode={previewMode}
        />
      </section>

      {lessonView.isFocusMode ? null : (
        <LessonCourseSidebar
          activeLessonId={data.lesson.id}
          lessonsCount={lessonView.lessons.length}
          modules={lessonView.visibleModules}
          previewMode={previewMode}
          progressPercent={data.progressPercent}
        />
      )}
    </div>
  );
}

function getLessonViewState({
  data,
  previewMode,
  query,
}: {
  data: LessonPageData;
  previewMode: StudentPreviewMode | null;
  query: LessonSearchParams;
}) {
  const lessons = getLessonsWithModule(data);
  const isFocusMode = query.focus === "1";

  return {
    courseHref: route(
      getPreviewAwareHref(`/app/cursos/${data.course.id}`, previewMode)
    ),
    focusHref: route(
      getHrefWithSearchParams(`/app/aulas/${data.lesson.id}`, {
        ...(query.busca ? { busca: query.busca } : {}),
        focus: isFocusMode ? undefined : "1",
        preview: previewMode ?? undefined,
      })
    ),
    isFocusMode,
    lessons,
    nextLesson: lessons.find(({ id }) => id === data.nextLessonId),
    previousLesson: lessons.find(({ id }) => id === data.previousLessonId),
    videoEmbedUrl: resolveLessonVideoEmbedUrl({
      embedUrl: data.lesson.videoEmbedUrl,
      provider: toVideoProvider(data.lesson.videoProvider),
    }),
    visibleModules: getVisibleModules(data, query.busca),
  };
}

function getVisibleModules(data: LessonPageData, busca?: string) {
  const searchQuery = busca?.trim().toLowerCase() ?? "";

  if (!searchQuery) {
    return data.modules;
  }

  return data.modules
    .map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) =>
        lesson.title.toLowerCase().includes(searchQuery)
      ),
    }))
    .filter((module) => module.lessons.length > 0);
}

function getLessonsWithModule(data: LessonPageData): LessonWithModule[] {
  return data.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      moduleTitle: module.title,
      title: lesson.title,
    }))
  );
}

function LessonMainContent({
  data,
  lessonView,
  previewMode,
}: {
  data: LessonPageData;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const details = (
    <LessonDetails
      data={data}
      isVideo={data.lesson.lessonType === "video"}
      lessonView={lessonView}
      previewMode={previewMode}
    />
  );

  if (data.lesson.lessonType === "video") {
    return (
      <LessonVideoPlayer
        durationSeconds={data.lesson.durationSeconds}
        initialWatchedPercent={data.lesson.watchProgress?.watchedPercent ?? 0}
        isPreview={Boolean(previewMode)}
        lessonId={data.lesson.id}
        title={data.lesson.title}
        videoEmbedUrl={lessonView.videoEmbedUrl}
        videoProvider={data.lesson.videoProvider}
      >
        {details}
      </LessonVideoPlayer>
    );
  }

  return (
    <>
      <LessonContentFrame lesson={data.lesson} />
      <div className="px-5 py-7 sm:px-9">{details}</div>
    </>
  );
}

function LessonDetails({
  data,
  isVideo,
  lessonView,
  previewMode,
}: {
  data: LessonPageData;
  isVideo: boolean;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  return (
    <>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1
          className={cn(
            "max-w-3xl font-bold text-2xl tracking-tight",
            isVideo ? "text-white" : "text-foreground"
          )}
        >
          {data.lesson.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={lessonView.focusHref}>
              <HugeiconsIcon
                icon={lessonView.isFocusMode ? Minimize01Icon : Maximize01Icon}
                size={16}
                strokeWidth={2}
              />
              {lessonView.isFocusMode ? "Sair do foco" : "Modo foco"}
            </Link>
          </Button>
          {data.lesson.isCompleted ? (
            <Badge
              className="border-emerald-400/35 bg-emerald-400/15 py-1.5 text-emerald-200"
              variant="outline"
            >
              Aula concluida
            </Badge>
          ) : (
            <CompleteLessonButton
              isPreview={Boolean(previewMode)}
              lessonId={data.lesson.id}
              size="sm"
            />
          )}
        </div>
      </div>
      {data.lesson.description ? (
        <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7">
          {data.lesson.description}
        </p>
      ) : null}

      <div className="mt-7 grid gap-3 md:grid-cols-2">
        <NavigationCard
          lesson={lessonView.previousLesson}
          previewMode={previewMode}
          type="previous"
        />
        <NavigationCard
          lesson={lessonView.nextLesson}
          previewMode={previewMode}
          type="next"
        />
      </div>

      <LessonNextStepCard
        courseHref={lessonView.courseHref}
        isCompleted={data.lesson.isCompleted}
        isPreview={Boolean(previewMode)}
        lessonId={data.lesson.id}
        nextLessonId={data.nextLessonId}
        previewMode={previewMode}
      />
    </>
  );
}

function LessonContentFrame({
  lesson,
}: {
  lesson: LessonPageData["lesson"];
}): React.JSX.Element {
  if (lesson.contentJson?.type === "text") {
    const resources =
      "resources" in lesson.contentJson ? lesson.contentJson.resources : [];
    const document =
      "document" in lesson.contentJson
        ? lesson.contentJson.document
        : createTextDocumentFromPlainText(lesson.contentJson.body);

    return (
      <article className="border-border/50 border-b bg-card px-5 py-8 sm:px-9">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <div className="text-base leading-8 [&_.lesson-rich-text_a]:font-medium [&_.lesson-rich-text_a]:text-primary [&_.lesson-rich-text_a]:underline [&_.lesson-rich-text_a]:underline-offset-4 [&_.lesson-rich-text_blockquote]:border-l-2 [&_.lesson-rich-text_blockquote]:pl-4 [&_.lesson-rich-text_blockquote]:text-muted-foreground [&_.lesson-rich-text_h2]:mt-6 [&_.lesson-rich-text_h2]:font-semibold [&_.lesson-rich-text_h2]:text-2xl [&_.lesson-rich-text_h3]:mt-5 [&_.lesson-rich-text_h3]:font-semibold [&_.lesson-rich-text_h3]:text-xl [&_.lesson-rich-text_ol]:ml-6 [&_.lesson-rich-text_ol]:list-decimal [&_.lesson-rich-text_p]:my-3 [&_.lesson-rich-text_ul]:ml-6 [&_.lesson-rich-text_ul]:list-disc">
            <LessonRichTextRenderer document={document} />
          </div>
          <LessonResources lessonId={lesson.id} resources={resources ?? []} />
        </div>
      </article>
    );
  }

  return (
    <div className="border-border/50 border-b bg-card px-5 py-12 text-center text-muted-foreground sm:px-9">
      Conteudo em configuracao.
    </div>
  );
}

function LessonResources({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: LessonResource[];
}): React.JSX.Element | null {
  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
      <h2 className="font-semibold text-sm">Materiais da aula</h2>
      <div className="flex flex-wrap gap-2">
        {resources.map((resource) => (
          <Button asChild key={resource.id} size="sm" variant="secondary">
            <a
              href={getLessonResourceHref({
                lessonId,
                resource,
              })}
              rel="noopener"
              target="_blank"
            >
              {resource.label}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                strokeWidth={2}
              />
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}

function getLessonResourceHref({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: LessonResource;
}): string {
  if (resource.storage === "r2") {
    return route(
      `/api/lessons/${lessonId}/resources/${resource.id}/download`
    ) as string;
  }

  return resource.url;
}

function LessonNextStepCard({
  courseHref,
  isCompleted,
  isPreview,
  lessonId,
  nextLessonId,
}: {
  courseHref: Route;
  isCompleted: boolean;
  isPreview: boolean;
  lessonId: string;
  nextLessonId: string | null;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element | null {
  if (!isCompleted) {
    return (
      <div className="mt-7 flex justify-end">
        <CompleteLessonButton isPreview={isPreview} lessonId={lessonId} />
      </div>
    );
  }

  if (!nextLessonId && isCompleted) {
    return (
      <div className="mt-7 flex justify-end">
        <Button asChild>
          <Link href={courseHref}>Ir para a página do curso</Link>
        </Button>
      </div>
    );
  }

  return null;
}

function LessonCourseSidebar({
  activeLessonId,
  lessonsCount,
  modules,
  previewMode,
  progressPercent,
}: {
  activeLessonId: string;
  lessonsCount: number;
  modules: LessonPageData["modules"];
  previewMode: StudentPreviewMode | null;
  progressPercent: number;
}): React.JSX.Element {
  return (
    <aside className="sticky top-0 hidden h-[calc(100svh-4rem)] w-[340px] flex-col border-sidebar-border border-l bg-sidebar text-sidebar-foreground lg:flex">
      <div className="shrink-0 border-sidebar-border border-b px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Conteúdo do curso</p>
            <p className="mt-1 text-sidebar-foreground/55 text-xs">
              {progressPercent}% concluído
            </p>
          </div>
          <Badge variant="outline">{lessonsCount} aulas</Badge>
        </div>
        <Progress className="mt-3 h-1 bg-primary/20" value={progressPercent} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {modules.map((module) => (
          <SidebarGroup key={module.id}>
            <SidebarGroupLabel>Módulo {module.sortOrder}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {module.lessons.map((lesson) => (
                  <LessonSidebarItem
                    activeLessonId={activeLessonId}
                    key={lesson.id}
                    lesson={lesson}
                    previewMode={previewMode}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {modules.length === 0 ? (
          <p className="px-4 py-5 text-sidebar-foreground/55 text-sm">
            Nenhuma aula encontrada para essa busca.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function CompleteLessonButton({
  isPreview,
  lessonId,
  size,
}: {
  isPreview: boolean;
  lessonId: string;
  size?: "default" | "sm";
}): React.JSX.Element {
  if (isPreview) {
    return (
      <Button disabled size={size} type="button" variant="secondary">
        <HugeiconsIcon icon={TaskEdit01Icon} size={16} strokeWidth={2} />
        Preview sem progresso
      </Button>
    );
  }

  return (
    <form action={completeLessonAction}>
      <input name="lessonId" type="hidden" value={lessonId} />
      <Button className="gap-2" size={size} type="submit" variant="secondary">
        <HugeiconsIcon icon={TaskEdit01Icon} size={16} strokeWidth={2} />
        Concluir aula
      </Button>
    </form>
  );
}

function NavigationCard({
  lesson,
  previewMode,
  type,
}: {
  lesson: LessonWithModule | undefined;
  previewMode: StudentPreviewMode | null;
  type: "next" | "previous";
}): React.JSX.Element {
  const label = type === "previous" ? "Aula anterior" : "Próxima aula";

  if (!lesson) {
    return (
      <div className="rounded-lg border bg-card/55 p-4 text-muted-foreground">
        <p className="text-xs">{label}</p>
        <p className="mt-1 font-medium text-sm">
          {type === "previous" ? "Você está no início" : "Fim da trilha"}
        </p>
      </div>
    );
  }

  return (
    <Button asChild className="h-auto justify-start p-4" variant="outline">
      <Link
        href={route(
          getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode)
        )}
      >
        <span className="min-w-0 text-left">
          <span className="block text-muted-foreground text-xs">{label}</span>
          <span className="mt-1 block truncate font-semibold">
            {lesson.title}
          </span>
          <span className="mt-1 block truncate text-muted-foreground text-xs">
            {lesson.moduleTitle}
          </span>
        </span>
      </Link>
    </Button>
  );
}

function LessonSidebarItem({
  activeLessonId,
  lesson,
  previewMode,
}: {
  activeLessonId: string;
  lesson: LessonPageData["modules"][number]["lessons"][number];
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const marker = getLessonMarker(lesson);
  const content = (
    <>
      <span className="w-4 text-sidebar-foreground/50 text-xs">{marker}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {lesson.isCompleted ? "Concluída · " : ""}
          {lesson.title}
        </span>
        {lesson.isAvailable ? null : (
          <span className="block text-sidebar-foreground/40 text-xs">
            Libere concluindo a aula anterior
          </span>
        )}
      </span>
      <span className="ml-auto text-sidebar-foreground/40 text-xs">
        {formatLessonDuration(lesson.durationSeconds)}
      </span>
    </>
  );

  if (!lesson.isAvailable) {
    return (
      <SidebarMenuItem>
        <div className="flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground/45 text-sm">
          {content}
        </div>
      </SidebarMenuItem>
    );
  }

  const href = route(
    getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode)
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuLink href={href} isActive={lesson.id === activeLessonId}>
        {content}
      </SidebarMenuLink>
    </SidebarMenuItem>
  );
}

function getLessonMarker({
  isAvailable,
  isCompleted,
}: {
  isAvailable: boolean;
  isCompleted: boolean;
}): string {
  if (isCompleted) {
    return "✓";
  }

  if (isAvailable) {
    return "•";
  }

  return "–";
}
