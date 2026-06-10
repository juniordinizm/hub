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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getStudentLessonData } from "@/features/courses/server";
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

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-13 items-center justify-between gap-4 border-b bg-sidebar px-5 sm:px-8">
          <Link
            className="text-muted-foreground text-sm hover:text-foreground"
            href={route("/app")}
          >
            Voltar ao inicio
          </Link>
          <p className="hidden truncate font-semibold text-sm sm:block">
            {data.course.title}
          </p>
          <form action={completeLessonAction}>
            <input name="lessonId" type="hidden" value={data.lesson.id} />
            <Button size="sm" type="submit" variant="secondary">
              Concluir
            </Button>
          </form>
        </div>
        <AspectRatio className="overflow-hidden bg-black" ratio={16 / 9}>
          {data.lesson.videoEmbedUrl ? (
            <iframe
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={data.lesson.videoEmbedUrl}
              title={data.lesson.title}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Video em configuracao
            </div>
          )}
        </AspectRatio>
        <div className="px-5 py-7 sm:px-9">
          <Badge
            className="border-primary/30 bg-primary/15 text-primary"
            variant="outline"
          >
            {data.course.title} - {data.lesson.durationMinutes} min
          </Badge>
          <h1 className="mt-3 max-w-3xl font-bold text-2xl text-white tracking-tight">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7">
              {data.lesson.description}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {data.nextLessonId ? (
              <Button asChild>
                <Link href={route(`/app/aulas/${data.nextLessonId}`)}>
                  Proxima aula
                </Link>
              </Button>
            ) : null}
            <form action={completeLessonAction}>
              <input name="lessonId" type="hidden" value={data.lesson.id} />
              <Button type="submit" variant="outline">
                Concluir aula
              </Button>
            </form>
          </div>
        </div>
      </section>
      <Sidebar
        className="w-full border-sidebar-border border-l bg-sidebar text-sidebar-foreground lg:w-[320px]"
        collapsible="none"
        side="right"
      >
        <SidebarHeader className="border-sidebar-border border-b px-5 py-5">
          <p className="font-semibold text-sm">Conteudo do curso</p>
          <p className="mt-1 text-sidebar-foreground/55 text-xs">
            {data.progressPercent}% concluido
          </p>
          <Progress
            className="mt-3 h-1 bg-primary/20"
            value={data.progressPercent}
          />
          <form className="mt-4" method="get">
            <Input
              className="bg-primary/10"
              defaultValue={busca ?? ""}
              name="busca"
              placeholder="Buscar conteudo"
            />
          </form>
        </SidebarHeader>
        <SidebarContent className="px-2 py-2">
          {visibleModules.map((module) => (
            <SidebarGroup key={module.id}>
              <SidebarGroupLabel>Modulo {module.sortOrder}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {module.lessons.map((lesson) => (
                    <SidebarMenuItem key={lesson.id}>
                      <SidebarMenuButton
                        asChild
                        className={
                          lesson.isAvailable
                            ? undefined
                            : "pointer-events-none opacity-50"
                        }
                        isActive={lesson.id === data.lesson.id}
                      >
                        <Link
                          aria-disabled={!lesson.isAvailable}
                          href={route(
                            lesson.isAvailable ? `/app/aulas/${lesson.id}` : "#"
                          )}
                        >
                          <span>
                            {lesson.isCompleted ? "Concluida - " : ""}
                            {lesson.title}
                          </span>
                          <span className="ml-auto text-sidebar-foreground/40 text-xs">
                            {lesson.durationMinutes}m
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
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
