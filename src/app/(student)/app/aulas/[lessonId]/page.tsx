import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeLessonAction } from "@/app/(student)/app/actions";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import { getStudentLessonData } from "@/features/courses/server";
import {
  resolveLessonVideoEmbedUrl,
  toVideoProvider,
} from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ busca?: string }>;
}): Promise<React.JSX.Element> {
  const [{ lessonId }, { busca }, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const data = await getStudentLessonData({
    userId: session.user.id,
    lessonId,
  });

  if (!data) {
    notFound();
  }

  const searchQuery = busca?.trim().toLowerCase() ?? "";
  const visibleModules = searchQuery
    ? data.modules
        .map((module) => ({
          ...module,
          lessons: module.lessons.filter((lesson) =>
            lesson.title.toLowerCase().includes(searchQuery)
          ),
        }))
        .filter((module) => module.lessons.length > 0)
    : data.modules;
  const lessons = data.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      ...lesson,
      moduleTitle: module.title,
    }))
  );
  const previousLesson = lessons.find(
    (lesson) => lesson.id === data.previousLessonId
  );
  const nextLesson = lessons.find((lesson) => lesson.id === data.nextLessonId);
  const videoEmbedUrl = resolveLessonVideoEmbedUrl({
    embedUrl: data.lesson.videoEmbedUrl,
    provider: toVideoProvider(data.lesson.videoProvider),
  });

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-4 border-b bg-sidebar px-5 py-2 sm:px-8">
          <Button asChild size="sm" variant="ghost">
            <Link href={route(`/app/cursos/${data.course.id}`)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
              Curso
            </Link>
          </Button>
          <p className="hidden truncate font-semibold text-sm sm:block">
            {data.course.title}
          </p>
          {data.lesson.isCompleted ? (
            <Badge
              className="border-emerald-400/35 bg-emerald-400/15 text-emerald-200"
              variant="outline"
            >
              Aula concluída
            </Badge>
          ) : (
            <CompleteLessonButton lessonId={data.lesson.id} size="sm" />
          )}
        </div>

        <AspectRatio className="overflow-hidden bg-black" ratio={16 / 9}>
          {videoEmbedUrl ? (
            <iframe
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              referrerPolicy="strict-origin-when-cross-origin"
              src={videoEmbedUrl}
              title={data.lesson.title}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
              Vídeo em configuração
            </div>
          )}
        </AspectRatio>

        <div className="px-5 py-7 sm:px-9">
          <Badge
            className="border-primary/30 bg-primary/15 text-primary"
            variant="outline"
          >
            {data.lesson.durationMinutes} min · {data.progressPercent}% do curso
          </Badge>
          <h1 className="mt-3 max-w-3xl font-bold text-2xl text-white tracking-tight">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7">
              {data.lesson.description}
            </p>
          ) : null}

          <div className="mt-7 grid gap-3 md:grid-cols-2">
            <NavigationCard lesson={previousLesson} type="previous" />
            <NavigationCard lesson={nextLesson} type="next" />
          </div>

          <div className="mt-7 rounded-lg border bg-card p-5">
            {data.nextLessonId ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Próximo passo</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Conclua esta aula para liberar a próxima etapa da trilha.
                  </p>
                </div>
                {data.lesson.isCompleted ? (
                  <Button asChild>
                    <Link href={route(`/app/aulas/${data.nextLessonId}`)}>
                      Ir para próxima aula
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                    </Link>
                  </Button>
                ) : (
                  <CompleteLessonButton lessonId={data.lesson.id} />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">
                    {data.lesson.isCompleted
                      ? "Curso finalizado"
                      : "Última aula da trilha"}
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {data.lesson.isCompleted
                      ? "Seu progresso está completo. Confira a página do curso e o certificado."
                      : "Conclua esta aula para fechar o curso e emitir o certificado."}
                  </p>
                </div>
                {data.lesson.isCompleted ? (
                  <Button asChild>
                    <Link href={route(`/app/cursos/${data.course.id}`)}>
                      Ver conclusão
                    </Link>
                  </Button>
                ) : (
                  <CompleteLessonButton lessonId={data.lesson.id} />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <Sidebar
        className="w-full border-sidebar-border border-l bg-sidebar text-sidebar-foreground lg:w-[340px]"
        collapsible="none"
        side="right"
      >
        <SidebarHeader className="border-sidebar-border border-b px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Conteúdo do curso</p>
              <p className="mt-1 text-sidebar-foreground/55 text-xs">
                {data.progressPercent}% concluído
              </p>
            </div>
            <Badge variant="outline">{lessons.length} aulas</Badge>
          </div>
          <Progress
            className="mt-3 h-1 bg-primary/20"
            value={data.progressPercent}
          />
          <form className="mt-4" method="get">
            <Input
              aria-label="Buscar aula no curso"
              className="bg-primary/10"
              defaultValue={busca ?? ""}
              name="busca"
              placeholder="Buscar conteúdo..."
            />
          </form>
        </SidebarHeader>
        <SidebarContent className="px-2 py-2">
          {visibleModules.map((module) => (
            <SidebarGroup key={module.id}>
              <SidebarGroupLabel>Módulo {module.sortOrder}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {module.lessons.map((lesson) => (
                    <LessonSidebarItem
                      activeLessonId={data.lesson.id}
                      key={lesson.id}
                      lesson={lesson}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          {visibleModules.length === 0 ? (
            <p className="px-4 py-5 text-sidebar-foreground/55 text-sm">
              Nenhuma aula encontrada para essa busca.
            </p>
          ) : null}
        </SidebarContent>
        {data.course.supportWhatsappUrl ? (
          <Button asChild className="m-4 mt-2" variant="outline">
            <a
              href={data.course.supportWhatsappUrl}
              rel="noopener"
              target="_blank"
            >
              Falar com suporte
            </a>
          </Button>
        ) : null}
      </Sidebar>
    </div>
  );
}

function CompleteLessonButton({
  lessonId,
  size,
}: {
  lessonId: string;
  size?: "default" | "sm";
}): React.JSX.Element {
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
  type,
}: {
  lesson:
    | {
        id: string;
        moduleTitle: string;
        title: string;
      }
    | undefined;
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
      <Link href={route(`/app/aulas/${lesson.id}`)}>
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
}: {
  activeLessonId: string;
  lesson: {
    durationMinutes: number;
    id: string;
    isAvailable: boolean;
    isCompleted: boolean;
    title: string;
  };
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
        {lesson.durationMinutes}m
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

  const href = route(`/app/aulas/${lesson.id}`);

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
