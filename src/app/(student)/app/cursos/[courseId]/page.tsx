import {
  BookOpen01Icon,
  Certificate01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getStudentCoursePrimaryHref } from "@/features/courses/presentation";
import {
  getPreviewAwareHref,
  getStudentPreviewMode,
} from "@/features/courses/preview";
import {
  getCoursePreviewOverviewData,
  getStudentCourseOverviewData,
} from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CourseOverviewClient } from "./course-overview-client";

export const dynamic = "force-dynamic";

function getCourseButtonLabel(
  progressPercent: number,
  hasNextLesson: boolean
): string {
  if (progressPercent === 0) {
    return "Iniciar curso";
  }
  if (hasNextLesson) {
    return "Continuar curso";
  }
  return "Rever trilha";
}

export default async function StudentCourseOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const [{ courseId }, { preview }, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const previewMode = getStudentPreviewMode({ preview, role: session.role });
  const data = previewMode
    ? await getCoursePreviewOverviewData({ courseId })
    : await getStudentCourseOverviewData({
        courseId,
        userId: session.user.id,
      });

  if (!data) {
    notFound();
  }

  const primaryHref = route(
    getPreviewAwareHref(
      getStudentCoursePrimaryHref({
        courseId: data.course.id,
        nextLessonId: data.nextLessonId,
      }),
      previewMode
    )
  );
  const backHref = route(
    previewMode ? `/admin/cursos/${data.course.id}` : "/app"
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-border/50 border-b bg-muted/15 px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
        <Button
          asChild
          className="mb-6 -ml-3 text-muted-foreground hover:text-foreground"
          size="sm"
          variant="ghost"
        >
          <Link href={backHref}>
            {previewMode ? "Sair do preview" : "← Voltar para meus cursos"}
          </Link>
        </Button>

        {previewMode ? (
          <div className="mb-6 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm">
            <strong>Preview de aluno.</strong> Todas as aulas ficam liberadas e
            nenhum progresso é gravado.
          </div>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Trilha privada</Badge>
              {data.certificateCode ? (
                <Badge variant="outline">Certificado liberado</Badge>
              ) : null}
            </div>
            <h1 className="mt-4 font-extrabold text-3xl tracking-tight md:text-5xl">
              {data.course.title}
            </h1>
            <p className="mt-4 max-w-3xl text-muted-foreground text-sm leading-7 md:text-base">
              {data.course.subtitle ??
                data.course.description ??
                "Avance pelas aulas na ordem da trilha, acompanhe seu progresso e conclua o curso para liberar o certificado."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <CourseMetric
                icon={BookOpen01Icon}
                label="Aulas"
                value={data.totalCount.toString()}
              />
              <CourseMetric
                icon={Clock01Icon}
                label="Carga horária"
                value={`${data.course.workloadHours}h`}
              />
              <CourseMetric
                icon={Certificate01Icon}
                label="Conclusão"
                value={`${data.progressPercent}%`}
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-lg border bg-card p-5 xl:shrink-0">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Progresso do curso
                </span>
                <span className="font-semibold">{data.progressPercent}%</span>
              </div>
              <Progress className="h-2" value={data.progressPercent} />
              <p className="mt-3 text-muted-foreground text-sm">
                {data.completedCount} de {data.totalCount} aulas concluídas.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button asChild className="w-full sm:flex-1 xl:w-full">
                <Link href={primaryHref}>
                  {getCourseButtonLabel(
                    data.progressPercent,
                    Boolean(data.nextLessonId)
                  )}
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
                <SupportRequestDialog
                  courseTitle={data.course.title}
                  triggerClassName="flex-1"
                  triggerLabel="Suporte"
                  triggerSize="sm"
                  triggerVariant="secondary"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <CourseOverviewClient
        modules={data.modules}
        nextLessonId={data.nextLessonId}
        previewMode={previewMode}
      />
    </main>
  );
}

function CourseMetric({
  icon,
  label,
  value,
}: {
  icon: typeof BookOpen01Icon;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <HugeiconsIcon icon={icon} />
        {label}
      </div>
      <p className="mt-2 font-bold text-2xl tabular-nums">{value}</p>
    </div>
  );
}
