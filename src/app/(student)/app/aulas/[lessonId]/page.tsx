import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Download01Icon,
  ExternalLinkIcon,
  File01Icon,
  FileArchiveIcon,
  FileDownloadIcon,
  FileImageIcon,
  FileLinkIcon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { completeLessonAction } from "@/app/(student)/app/actions";
import { LessonCommentsSection } from "@/components/lesson-comments-section";
import {
  LessonFocusHidden,
  LessonFocusLayout,
  LessonFocusToggle,
} from "@/components/lesson-focus-mode";
import { LessonRichTextRenderer } from "@/components/lesson-rich-text-renderer";
import { LessonVideoPlayer } from "@/components/lesson-video-player";
import { LessonVideoProcessing } from "@/components/lesson-video-processing";
import { RegisterPreviewCourseId } from "@/components/panel-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import { getLessonComments } from "@/features/comments/server";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  canAccessStudentRoute,
  getPreviewAwareHref,
  getStudentPreviewMode,
  type StudentPreviewMode,
} from "@/features/courses/preview";
import {
  formatResourceFileSize,
  getResourceTypeLabel,
  getResourceExtension as getSharedResourceExtension,
} from "@/features/courses/resource-presentation";
import { getStudentLessonWorkspace } from "@/features/courses/server";
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
  Awaited<ReturnType<typeof getStudentLessonWorkspace>>
>;
type LessonCommentsData = Awaited<ReturnType<typeof getLessonComments>>;
interface LessonSearchParams {
  busca?: string;
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

  const data = await getStudentLessonWorkspace({
    lessonId,
    viewer: {
      role: session.role,
      userId: session.user.id,
    },
  });

  if (!data) {
    notFound();
  }

  const commentsData = await getLessonComments({
    lessonId: data.lesson.id,
    role: session.role,
    userId: session.user.id,
  });
  const lessonView = getLessonViewState({
    data,
    query,
    previewMode,
  });

  return (
    <LessonFocusLayout
      main={
        <>
          {previewMode ? (
            <RegisterPreviewCourseId courseId={data.course.id} />
          ) : null}

          <LessonMainContent
            commentsData={commentsData}
            data={data}
            lessonView={lessonView}
            previewMode={previewMode}
          />
        </>
      }
      sidebar={
        <LessonCourseSidebar
          activeLessonId={data.lesson.id}
          lessonsCount={lessonView.lessons.length}
          modules={lessonView.visibleModules}
          previewMode={previewMode}
          progressPercent={data.progressPercent}
        />
      }
    />
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

  return {
    courseHref: route(
      getPreviewAwareHref(`/app/cursos/${data.course.id}`, previewMode)
    ),
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
  commentsData,
  data,
  lessonView,
  previewMode,
}: {
  commentsData: LessonCommentsData;
  data: LessonPageData;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const header = <LessonHeader data={data} previewMode={previewMode} />;

  const footer = (
    <LessonFooter
      data={data}
      lessonView={lessonView}
      previewMode={previewMode}
    />
  );
  const commentsSection = (
    <LessonFocusHidden>
      <LessonCommentsSection
        canComment={!previewMode}
        canModerate={false}
        comments={commentsData.comments}
        context="student"
        lessonId={data.lesson.id}
        totalCount={commentsData.totalCount}
      />
    </LessonFocusHidden>
  );
  const videoProcessing = Boolean(
    data.lesson.videoProvider === "jmvstream" &&
      data.lesson.videoExternalId &&
      !lessonView.videoEmbedUrl
  );

  if (lessonView.videoEmbedUrl) {
    return (
      <div className="flex flex-col">
        <LessonVideoPlayer
          durationSeconds={data.lesson.durationSeconds}
          initialWatchedPercent={data.lesson.watchProgress?.watchedPercent ?? 0}
          isPreview={Boolean(previewMode)}
          lessonId={data.lesson.id}
          title={data.lesson.title}
          videoEmbedUrl={lessonView.videoEmbedUrl}
          videoProvider={data.lesson.videoProvider}
        >
          {header}
          {data.lesson.contentJson ? (
            <LessonContentFrame lesson={data.lesson} />
          ) : null}
          <div className="mx-auto w-full max-w-5xl py-7">{footer}</div>
        </LessonVideoPlayer>
        {commentsSection}
      </div>
    );
  }

  if (videoProcessing) {
    return (
      <div className="flex flex-col">
        {header}
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
          <LessonVideoProcessing />
        </div>
        <LessonContentFrame lesson={data.lesson} />
        <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 lg:px-10">
          {footer}
        </div>
        {commentsSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {header}
      <LessonContentFrame lesson={data.lesson} />
      <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 lg:px-10">
        {footer}
      </div>
      {commentsSection}
    </div>
  );
}

function LessonHeader({
  data,
  previewMode,
}: {
  data: LessonPageData;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-5xl py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-medium text-foreground text-lg tracking-normal">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="mt-1 truncate font-light text-muted-foreground text-sm">
              {data.lesson.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LessonFocusToggle />
          {data.lesson.isCompleted ? (
            <Button className="gap-2" disabled size="sm" variant="secondary">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                strokeWidth={2}
              />
              Aula concluída
            </Button>
          ) : (
            <CompleteLessonButton
              accessibleLabel="Concluir aula no cabeçalho"
              isPreview={Boolean(previewMode)}
              lessonId={data.lesson.id}
              size="sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LessonFooter({
  data,
  lessonView,
  previewMode,
}: {
  data: LessonPageData;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <LessonNextStepCard
        courseHref={lessonView.courseHref}
        isCompleted={data.lesson.isCompleted}
        isPreview={Boolean(previewMode)}
        lessonId={data.lesson.id}
        nextLessonId={data.nextLessonId}
        previewMode={previewMode}
      />

      <div className="grid gap-3 md:grid-cols-2">
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
    </div>
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
    const { document } = lesson.contentJson;

    return (
      <article className="px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <div className="text-base leading-8">
            <LessonRichTextRenderer document={document} />
          </div>
          <LessonResources lessonId={lesson.id} resources={resources ?? []} />
        </div>
      </article>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center font-light text-muted-foreground sm:px-8 lg:px-10">
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
    <section className="mt-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground text-sm uppercase tracking-wider">
            Materiais Complementares
          </h2>
          <p className="mt-1 font-light text-muted-foreground text-xs">
            {resources.length}{" "}
            {resources.length === 1
              ? "documento anexado"
              : "documentos anexados"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {resources.map((resource) => (
          <LessonResourceItem
            key={resource.id}
            lessonId={lessonId}
            resource={resource}
          />
        ))}
      </div>
    </section>
  );
}

function LessonResourceItem({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: LessonResource;
}): React.JSX.Element {
  const extension = getResourceExtension(resource);
  const displayName = getResourceDisplayName(resource);
  const metadata = getResourceMetadata(resource);
  const href = getLessonResourceHref({ lessonId, resource });
  const isExternal = resource.storage !== "r2";
  const badgeText = isExternal ? "LINK" : extension;

  return (
    <div className="group/resource grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-border/30 border-b py-3 transition-colors last:border-0 hover:bg-muted/10">
      <ResourceVisual lessonId={lessonId} resource={resource} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-normal text-sm">
            {displayName.base}
            {displayName.extension ? (
              <span className="font-light text-muted-foreground">
                .{displayName.extension}
              </span>
            ) : null}
          </p>
          {badgeText ? (
            <span className="shrink-0 font-medium text-[10px] text-muted-foreground uppercase tracking-widest">
              {badgeText}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate font-light text-muted-foreground text-xs">
          {metadata}
        </p>
      </div>
      <Button
        asChild
        className="opacity-70 hover:opacity-100"
        size="icon-sm"
        variant="ghost"
      >
        <a
          aria-label={isExternal ? "Abrir material" : "Baixar material"}
          href={href}
          rel="noopener"
          target="_blank"
          title={isExternal ? "Abrir material" : "Baixar material"}
        >
          <HugeiconsIcon
            icon={isExternal ? ExternalLinkIcon : Download01Icon}
            size={16}
            strokeWidth={1.5}
          />
        </a>
      </Button>
    </div>
  );
}

function ResourceVisual({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: LessonResource;
}): React.JSX.Element {
  if (resource.storage === "r2" && resource.preview) {
    return (
      <div
        aria-label={`Preview de ${resource.label}`}
        className="aspect-square overflow-hidden rounded-md bg-center bg-cover bg-muted/20"
        role="img"
        style={{
          backgroundImage: `url(${getLessonResourcePreviewHref({
            lessonId,
            resource,
          })})`,
        }}
      />
    );
  }

  const Icon = getResourceIcon(resource);
  const tone = getResourceTone(resource);

  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-md bg-muted/10",
        tone
      )}
    >
      <HugeiconsIcon icon={Icon} size={20} strokeWidth={1.5} />
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

function getLessonResourcePreviewHref({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: Extract<LessonResource, { storage: "r2" }>;
}): string {
  return route(
    `/api/lessons/${lessonId}/resources/${resource.id}/preview`
  ) as string;
}

function getResourceExtension(resource: LessonResource): string | null {
  return getSharedResourceExtension(resource);
}

function getResourceDisplayName(resource: LessonResource): {
  base: string;
  extension: string | null;
} {
  const label = resource.label.trim() || "Material da aula";
  const extension = getResourceExtension(resource);

  if (!extension) {
    return { base: label, extension: null };
  }

  const suffix = `.${extension}`;

  return label.toLowerCase().endsWith(suffix)
    ? { base: label.slice(0, -suffix.length) || label, extension }
    : { base: label, extension };
}

function getResourceMetadata(resource: LessonResource): string {
  if (resource.storage !== "r2") {
    return "Link externo";
  }

  return `${getFileTypeLabel(resource)} · ${formatFileSize(resource.sizeBytes)}`;
}

function formatFileSize(sizeBytes: number): string {
  return formatResourceFileSize(sizeBytes);
}

function getFileTypeLabel(resource: LessonResource): string {
  return getResourceTypeLabel(resource);
}

function getResourceIcon(resource: LessonResource) {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return FileLinkIcon;
  }

  if (resource.contentType.startsWith("image/")) {
    return FileImageIcon;
  }

  if (extension === "pdf") {
    return Pdf01Icon;
  }

  if (extension === "zip") {
    return FileArchiveIcon;
  }

  if (
    extension &&
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return FileDownloadIcon;
  }

  return File01Icon;
}

function getResourceTone(_resource: LessonResource): string {
  return "bg-muted/50 text-muted-foreground";
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
      <div className="flex justify-end">
        <CompleteLessonButton
          accessibleLabel="Concluir aula e avançar"
          isPreview={isPreview}
          lessonId={lessonId}
        />
      </div>
    );
  }

  if (!nextLessonId && isCompleted) {
    return (
      <div className="flex justify-end">
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
    <Sidebar
      className="hidden h-full w-[340px] shrink-0 border-l-0 lg:flex"
      collapsible="none"
      side="right"
    >
      <div className="shrink-0 border-b-0 px-6 py-6">
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
    </Sidebar>
  );
}

function CompleteLessonButton({
  accessibleLabel,
  isPreview,
  lessonId,
  size,
}: {
  accessibleLabel: string;
  isPreview: boolean;
  lessonId: string;
  size?: "default" | "sm";
}): React.JSX.Element {
  if (isPreview) {
    return (
      <Button disabled size={size} type="button" variant="secondary">
        <HugeiconsIcon icon={CircleIcon} size={16} strokeWidth={2} />
        Preview sem progresso
      </Button>
    );
  }

  return (
    <form action={completeLessonAction}>
      <input name="lessonId" type="hidden" value={lessonId} />
      <Button
        aria-label={accessibleLabel}
        className="gap-2"
        size={size}
        type="submit"
        variant="secondary"
      >
        <HugeiconsIcon icon={CircleIcon} size={16} strokeWidth={2} />
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
      <div
        className={cn(
          "flex flex-col rounded-xl border bg-card/55 p-4 text-muted-foreground/55",
          type === "previous" ? "items-start text-left" : "items-end text-right"
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-col",
            type === "previous"
              ? "items-start text-left"
              : "items-end text-right"
          )}
        >
          <span className="flex items-center gap-1.5 text-muted-foreground/45 text-xs">
            {type === "previous" && (
              <HugeiconsIcon
                className="shrink-0"
                icon={ArrowLeftIcon}
                size={14}
                strokeWidth={2}
              />
            )}
            {label}
            {type === "next" && (
              <HugeiconsIcon
                className="shrink-0"
                icon={ArrowRightIcon}
                size={14}
                strokeWidth={2}
              />
            )}
          </span>
          <span className="mt-1 block font-medium text-sm">
            {type === "previous" ? "Você está no início" : "Fim da trilha"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Button
      asChild
      className={cn(
        "h-auto rounded-xl p-4",
        type === "previous"
          ? "justify-start text-left"
          : "justify-end text-right"
      )}
      variant="outline"
    >
      <Link
        href={route(
          getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode)
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            type === "previous"
              ? "items-start text-left"
              : "items-end text-right"
          )}
        >
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            {type === "previous" && (
              <HugeiconsIcon
                className="shrink-0"
                icon={ArrowLeftIcon}
                size={14}
                strokeWidth={2}
              />
            )}
            {label}
            {type === "next" && (
              <HugeiconsIcon
                className="shrink-0"
                icon={ArrowRightIcon}
                size={14}
                strokeWidth={2}
              />
            )}
          </span>
          <span className="mt-1 block w-full truncate font-semibold">
            {lesson.title}
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
