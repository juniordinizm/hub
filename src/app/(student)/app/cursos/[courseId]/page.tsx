import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getStudentCoursePrimaryHref } from "@/features/courses/presentation";
import { getStudentCourseOverviewData } from "@/features/courses/server";
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
            <h1 className="font-bold text-3xl tracking-tight md:text-4xl">
              {data.course.title}
            </h1>
            {data.course.subtitle ? (
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed md:text-base">
                {data.course.subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-4 lg:max-w-xs lg:shrink-0">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {data.totalCount}
                  </span>{" "}
                  aulas
                  <span>·</span>
                  <span className="font-medium text-foreground">
                    {data.course.workloadHours}h
                  </span>{" "}
                  total
                </div>
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
    </main>
  );
}
