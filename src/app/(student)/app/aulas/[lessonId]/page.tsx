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

const RESOURCE_NAME_QUERY_PATTERN = /[?#]/;

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
          <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-0">
            {footer}
          </div>
        </LessonVideoPlayer>
        {commentsSection}
      </div>
    );
  }

  if (videoProcessing) {
    return (
      <div className="flex flex-col">
        {header}
        <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-0">
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border bg-muted/35 px-6 text-center">
            <p className="font-semibold text-foreground">
              Video em processamento
            </p>
            <p className="max-w-lg text-muted-foreground text-sm">
              O arquivo ja foi enviado e a JMVStream esta preparando o player.
              Esta aula fica disponivel automaticamente em alguns minutos.
            </p>
          </div>
        </div>
        <LessonContentFrame lesson={data.lesson} />
        <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-0">
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
      <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-0">{footer}</div>
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
    <div className="mx-auto w-full max-w-5xl border-border/50 border-b bg-background px-5 py-3 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-base text-foreground tracking-tight">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="truncate text-muted-foreground text-sm">
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
      <article className="px-5 py-8 sm:px-0">
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
    <div className="mx-auto w-full max-w-5xl px-5 py-12 text-center text-muted-foreground sm:px-0">
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
    <section className="rounded-xl bg-muted/35 p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] sm:p-4 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-semibold text-sm">Materiais da aula</h2>
          <p className="text-muted-foreground text-xs">
            {resources.length} {resources.length === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    <div className="group/resource grid h-full min-w-0 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-background/80 p-2 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-background sm:grid-cols-[72px_minmax(0,1fr)_auto] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.09)]">
      <ResourceVisual lessonId={lessonId} resource={resource} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-sm">
            {displayName.base}
            {displayName.extension ? (
              <span className="text-muted-foreground">
                .{displayName.extension}
              </span>
            ) : null}
          </p>
          {badgeText ? (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-normal">
              {badgeText}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-muted-foreground text-xs">
          {metadata}
        </p>
      </div>
      <Button asChild size="icon-sm" variant="ghost">
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
            strokeWidth={2}
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
        className="aspect-video overflow-hidden rounded-md bg-center bg-cover bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
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
        "flex aspect-video items-center justify-center rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        tone
      )}
    >
      <HugeiconsIcon icon={Icon} size={22} strokeWidth={2} />
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
  if (resource.storage === "r2") {
    return getFileExtension(resource.fileName);
  }

  try {
    return getFileExtension(new URL(resource.url).pathname);
  } catch {
    return null;
  }
}

function getFileExtension(fileName: string): string | null {
  const cleanName = fileName.split(RESOURCE_NAME_QUERY_PATTERN)[0] ?? "";
  const lastSegment = cleanName.split("/").pop() ?? "";
  const extension = lastSegment.includes(".")
    ? lastSegment.split(".").pop()
    : null;

  return extension?.trim().toLowerCase() || null;
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
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString(
    "pt-BR"
  )} KB`;
}

function getFileTypeLabel(resource: LessonResource): string {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return "Link";
  }

  if (resource.contentType.startsWith("image/")) {
    return "Imagem";
  }

  if (extension === "pdf") {
    return "PDF";
  }

  if (extension && ["doc", "docx"].includes(extension)) {
    return "Documento";
  }

  if (extension && ["xls", "xlsx", "csv"].includes(extension)) {
    return "Planilha";
  }

  if (extension && ["ppt", "pptx"].includes(extension)) {
    return "Apresentacao";
  }

  if (extension === "zip") {
    return "Arquivo compactado";
  }

  return "Arquivo";
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
        <CompleteLessonButton isPreview={isPreview} lessonId={lessonId} />
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
      className="hidden h-full w-[340px] shrink-0 border-sidebar-border border-l lg:flex"
      collapsible="none"
      side="right"
    >
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
    </Sidebar>
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
        <HugeiconsIcon icon={CircleIcon} size={16} strokeWidth={2} />
        Preview sem progresso
      </Button>
    );
  }

  return (
    <form action={completeLessonAction}>
      <input name="lessonId" type="hidden" value={lessonId} />
      <Button className="gap-2" size={size} type="submit" variant="secondary">
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
