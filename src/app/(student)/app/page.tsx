import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getPublishedFaqItems,
  getStudentCourses,
  getSupportWhatsappUrl,
} from "@/features/courses/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const getModuleHref = ({
  courseNextLessonId,
  moduleNextLessonId,
}: {
  courseNextLessonId: string | null;
  moduleNextLessonId: string | null;
}): string => {
  if (moduleNextLessonId) {
    return `/app/aulas/${moduleNextLessonId}`;
  }

  if (courseNextLessonId) {
    return `/app/aulas/${courseNextLessonId}`;
  }

  return "/app/certificados";
};

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const [courses, faqs, supportWhatsappUrl] = await Promise.all([
    getStudentCourses(session.user.id),
    getPublishedFaqItems(),
    getSupportWhatsappUrl(),
  ]);
  const course = courses[0];
  const modules = courses.flatMap((courseData) =>
    courseData.modules.map((moduleData) => ({
      ...moduleData,
      courseNextLessonId: courseData.nextLessonId,
    }))
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative h-[220px] overflow-hidden bg-muted">
        <Image
          alt="Sistema PROTEA-R"
          className="object-cover object-right"
          fill
          priority
          src="/protear/dash-banner.png"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/80 to-sidebar/10" />
        <div className="relative z-10 px-6 py-10 sm:px-10 lg:px-12">
          <Badge
            className="border-accent/40 bg-accent/20 text-accent"
            variant="outline"
          >
            Seu Curso
          </Badge>
          <h1 className="mt-3 max-w-xl font-extrabold text-3xl text-white tracking-tight">
            Sistema <span className="text-accent">PROTEA-R</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Avaliacao de suspeita de TEA
            {course
              ? ` - ${course.modules.length} modulos - ${course.totalCount} aulas`
              : ""}
          </p>
        </div>
      </header>

      <div className="px-6 py-9 sm:px-10 lg:px-12">
        {courses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum curso ativo</CardTitle>
              <CardDescription>
                Sua conta existe, mas nao ha uma matricula ativa no momento.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <section>
            <div className="mb-5">
              <h2 className="font-bold text-base">Continuar assistindo</h2>
              <p className="mt-1 text-muted-foreground text-xs">
                Retome de onde voce parou
              </p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {courses.map((courseData) => (
                <Link
                  className="group w-[180px] shrink-0"
                  href={route(
                    courseData.nextLessonId
                      ? `/app/aulas/${courseData.nextLessonId}`
                      : "/app/certificados"
                  )}
                  key={courseData.courseId}
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-card transition-transform group-hover:-translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/70 to-sidebar" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span
                        aria-hidden="true"
                        className="flex size-9 items-center justify-center rounded-full bg-white/90"
                      >
                        <span className="ml-0.5 size-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-primary" />
                      </span>
                    </div>
                    <span className="absolute bottom-2 left-2 rounded-md bg-primary px-2 py-0.5 font-bold text-[0.6rem] text-primary-foreground uppercase tracking-[0.08em]">
                      {courseData.nextLessonId ? "Em andamento" : "Concluido"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold text-sm">
                    {courseData.title}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Acesso ate {formatDate(courseData.expiresAt)}
                  </p>
                  <Progress
                    className="mt-2 h-1"
                    value={courseData.progressPercent}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {modules.length ? (
          <section className="mt-10">
            <div className="mb-5">
              <h2 className="font-bold text-base">Conteudo do Curso</h2>
              <p className="mt-1 text-muted-foreground text-xs">
                {course?.modules.length ?? 0} modulos -{" "}
                {course?.totalCount ?? 0} aulas
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {modules.map((moduleData) => (
                <Card
                  className="group py-0 transition-transform hover:-translate-y-1 hover:ring-primary/40"
                  key={moduleData.id}
                >
                  <Link
                    href={route(
                      getModuleHref({
                        courseNextLessonId: moduleData.courseNextLessonId,
                        moduleNextLessonId: moduleData.nextLessonId,
                      })
                    )}
                  >
                    <div
                      className="relative aspect-video overflow-hidden rounded-t-4xl"
                      style={{ backgroundColor: moduleData.color }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/45" />
                      <span className="absolute top-3 left-3 rounded-md bg-primary px-2 py-1 font-bold text-[0.65rem] text-primary-foreground uppercase tracking-[0.08em]">
                        Modulo {moduleData.sortOrder}
                      </span>
                      <span className="absolute inset-0 flex items-center justify-center font-bold text-sm text-white/45 uppercase tracking-[0.14em]">
                        M{moduleData.sortOrder}
                      </span>
                    </div>
                    <CardHeader>
                      <CardDescription>
                        {moduleData.totalCount} aulas
                      </CardDescription>
                      <CardTitle className="line-clamp-2 text-sm">
                        {moduleData.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <p className="mb-2 text-muted-foreground text-xs">
                        {moduleData.completedCount} de {moduleData.totalCount}{" "}
                        aulas concluidas
                      </p>
                      <Progress
                        className="h-1"
                        value={moduleData.progressPercent}
                      />
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <CardTitle>Perguntas frequentes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {faqs.map((faq) => (
                <article className="border-t pt-4" key={faq.id}>
                  <p className="font-semibold">{faq.question}</p>
                  <p className="mt-2 text-muted-foreground text-sm">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>
          {supportWhatsappUrl ? (
            <Card>
              <CardHeader>
                <CardTitle>Precisa de ajuda?</CardTitle>
                <CardDescription>
                  Fale com o suporte pelo WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a href={supportWhatsappUrl} rel="noopener" target="_blank">
                    Falar com suporte
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}
