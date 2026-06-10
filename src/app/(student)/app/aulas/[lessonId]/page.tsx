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
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1fr_360px]">
      <section className="min-w-0 px-5 py-5 sm:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            className="text-muted-foreground text-sm hover:text-foreground"
            href={route("/app")}
          >
            Voltar ao inicio
          </Link>
          <form action={completeLessonAction}>
            <input name="lessonId" type="hidden" value={data.lesson.id} />
            <Button type="submit">Concluir aula</Button>
          </form>
        </div>
        <AspectRatio
          className="overflow-hidden rounded-3xl border bg-black"
          ratio={16 / 9}
        >
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
        <div className="mt-6">
          <Badge variant="outline">
            {data.course.title} - {data.lesson.durationMinutes} min
          </Badge>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            {data.lesson.title}
          </h1>
          {data.lesson.description ? (
            <p className="mt-4 max-w-3xl text-muted-foreground leading-7">
              {data.lesson.description}
            </p>
          ) : null}
        </div>
      </section>
      <Sidebar
        className="w-full border-l bg-card px-4 py-5 text-card-foreground lg:w-[360px]"
        collapsible="none"
        side="right"
      >
        <SidebarHeader className="px-0">
          <p className="font-semibold text-sm">Conteudo do curso</p>
          <Progress className="mt-3" value={data.progressPercent} />
          <form className="mt-4" method="get">
            <Input
              defaultValue={busca ?? ""}
              name="busca"
              placeholder="Buscar aula"
            />
          </form>
        </SidebarHeader>
        <SidebarContent className="px-0">
          {visibleModules.map((module) => (
            <SidebarGroup className="px-0" key={module.id}>
              <SidebarGroupLabel className="px-0">
                Modulo {module.sortOrder}
              </SidebarGroupLabel>
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
          <Button asChild className="mt-6 w-full" variant="outline">
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
