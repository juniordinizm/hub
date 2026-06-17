import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getCourseAccessPresentation,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import { getStudentCourseOverviewData } from "@/features/courses/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CourseOverviewClient } from "./course-overview-client";

export const dynamic = "force-dynamic";

export default async function StudentCourseOverviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<React.JSX.Element> {
  const [{ courseId }, session] = await Promise.all([params, requireSession()]);
  const data = await getStudentCourseOverviewData({
    courseId,
    userId: session.user.id,
  });

  if (!data) {
    notFound();
  }

  const access = getCourseAccessPresentation({
    expiresAt: data.course.expiresAt,
    progressPercent: data.progressPercent,
  });
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: data.course.id,
      nextLessonId: data.nextLessonId,
    })
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-border/50 border-b px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
        <Button
          asChild
          className="mb-6 -ml-3 text-muted-foreground hover:text-foreground"
          size="sm"
          variant="ghost"
        >
          <Link href={route("/app")}>← Voltar para meus cursos</Link>
        </Button>

        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl flex-1">
            <Badge
              className="border-accent/35 bg-accent/15 text-accent"
              variant="outline"
            >
              {access.label}
            </Badge>
            <h1 className="mt-3 font-bold text-3xl tracking-tight md:text-4xl">
              {data.course.title}
            </h1>
            {data.course.subtitle ? (
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed md:text-base">
                {data.course.subtitle}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-muted-foreground text-sm">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {data.totalCount}
                </span>{" "}
                aulas
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {data.course.workloadHours}h
                </span>{" "}
                carga horária
              </span>
              <span className="flex items-center gap-2">
                Acesso até{" "}
                <span className="font-semibold text-foreground">
                  {formatDate(data.course.expiresAt)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 lg:max-w-xs lg:shrink-0">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Progresso do curso
                </span>
                <span className="font-semibold text-primary">
                  {data.progressPercent}%
                </span>
              </div>
              <Progress className="h-1.5" value={data.progressPercent} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button asChild className="w-full sm:flex-1 lg:w-full">
                <Link href={primaryHref}>
                  {data.nextLessonId ? "Continuar curso" : "Rever trilha"}
                </Link>
              </Button>
              <div className="flex gap-2">
                {data.certificateCode ? (
                  <Button
                    asChild
                    className="flex-1"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={route(`/certificados/${data.certificateCode}`)}>
                      Certificado
                    </Link>
                  </Button>
                ) : null}
                {data.course.supportWhatsappUrl ? (
                  <Button
                    asChild
                    className="flex-1"
                    size="sm"
                    variant="secondary"
                  >
                    <a
                      href={data.course.supportWhatsappUrl}
                      rel="noopener"
                      target="_blank"
                    >
                      Suporte
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CourseOverviewClient
        modules={data.modules}
        nextLessonId={data.nextLessonId}
      />

      <section className="border-border/50 border-t px-6 py-8 sm:px-10 lg:px-12">
        <div className="max-w-4xl">
          <h2 className="font-semibold text-lg">Sobre este curso</h2>
          {data.course.description ? (
            <p className="mt-3 text-muted-foreground text-sm leading-7">
              {data.course.description}
            </p>
          ) : (
            <p className="mt-3 text-muted-foreground text-sm leading-7">
              A descrição ainda não foi cadastrada no admin.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-4 border-t pt-6 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">Concluídas:</span>
              <span className="font-medium text-foreground">
                {data.completedCount} de {data.totalCount}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Certificado:</span>
              <span className="font-medium text-foreground">
                {data.certificateCode ? "Emitido" : "Ao concluir"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
