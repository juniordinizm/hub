import { BookOpen01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { RegisterPreviewCourseId } from "@/components/panel-layout";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  formatCourseWorkload,
  getStudentCoursePrimaryHref,
} from "@/features/courses/presentation";
import {
  canAccessStudentRoute,
  getPreviewAwareHref,
  getStudentPreviewMode,
} from "@/features/courses/preview";
import { getStudentCourseOverview } from "@/features/courses/server";
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

function getCertificateHelper({
  certificateCode,
  certificateRenderStatus,
  completedCount,
  studentName,
  totalCount,
}: {
  certificateCode: string | null;
  certificateRenderStatus: "failed" | "pending" | "ready" | null;
  completedCount: number;
  studentName: string | null;
  totalCount: number;
}): string {
  if (certificateCode) {
    if (certificateRenderStatus === "ready") {
      return "Seu certificado está disponível para download em Meus certificados.";
    }
    if (certificateRenderStatus === "failed") {
      return "Falha no preparo do PDF. Fale com o suporte para receber ajuda.";
    }
    return "Você concluiu o curso. Estamos preparando seu PDF.";
  }
  const remainingLessons = Math.max(0, totalCount - completedCount);
  const expectedName = studentName
    ? ` O nome previsto é ${studentName}.`
    : " O certificado usará o nome do perfil da Aluna.";

  return `Faltam ${remainingLessons} aulas obrigatórias.${expectedName}`;
}

export default async function StudentCourseOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{
    certificate?: string | string[];
    preview?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  const [{ courseId }, { certificate, preview }, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const previewMode = getStudentPreviewMode({ preview, role: session.role });

  if (
    !canAccessStudentRoute({
      pathname: `/app/cursos/${courseId}`,
      previewMode,
      role: session.role,
    })
  ) {
    redirect(route("/admin"));
  }

  const data = await getStudentCourseOverview({
    courseId,
    viewer: {
      role: session.role,
      userId: session.user.id,
    },
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

  const totalDurationSeconds = data.modules.reduce(
    (acc, m) =>
      acc +
      m.lessons.reduce((sum, l) => sum + Math.max(0, l.durationSeconds), 0),
    0
  );

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-8">
          {previewMode ? (
            <RegisterPreviewCourseId courseId={data.course.id} />
          ) : null}

          {certificate === "issued" ? (
            <Alert className="border-emerald-600/40 bg-emerald-500/10">
              <AlertTitle>Curso concluído</AlertTitle>
              <AlertDescription>
                Seu certificado foi emitido. A preparação do PDF pode levar
                alguns instantes.
              </AlertDescription>
            </Alert>
          ) : null}

          <header className="border-b pb-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex-1 space-y-1">
                <h1 className="font-bold text-3xl tracking-tight">
                  {data.course.title}
                </h1>
                <p className="max-w-2xl text-muted-foreground text-sm">
                  {data.course.subtitle ??
                    data.course.description ??
                    "Avance pelas aulas na ordem da trilha, acompanhe seu progresso e conclua o curso para liberar o certificado."}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row">
                <CourseMetric
                  icon={BookOpen01Icon}
                  label="Aulas"
                  value={data.totalCount.toString()}
                />
                <CourseMetric
                  icon={Clock01Icon}
                  label="Carga horária"
                  value={formatCourseWorkload(totalDurationSeconds)}
                />

                <div className="flex min-w-[200px] flex-1 flex-col justify-center rounded-md border bg-card px-3 py-1 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-semibold text-foreground">
                      {data.progressPercent}%
                    </span>
                  </div>
                  <Progress className="h-1.5" value={data.progressPercent} />
                </div>

                <div className="flex shrink-0">
                  {data.progressPercent === 100 && data.certificateCode ? (
                    <Button
                      asChild
                      className="h-full w-full px-6 sm:w-auto"
                      size="sm"
                    >
                      <Link href={route("/app/certificados")}>
                        Ver em Meus certificados
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="h-full w-full px-6 sm:w-auto"
                      size="sm"
                    >
                      <Link href={primaryHref}>
                        {getCourseButtonLabel(
                          data.progressPercent,
                          Boolean(data.nextLessonId)
                        )}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>
          {data.certificateEnabled ? (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="font-semibold">Certificado de conclusão</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {getCertificateHelper(data)}
              </p>
              <Link
                className="mt-2 inline-block text-sm underline"
                href={route("/app/configuracoes")}
              >
                Conferir nome no perfil
              </Link>
              {data.certificateCode &&
              data.certificateRenderStatus === "failed" ? (
                <SupportRequestDialog
                  courseTitle={data.course.title}
                  triggerClassName="mt-3"
                  triggerLabel="Falar com suporte"
                  triggerSize="sm"
                />
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <CourseOverviewClient
        modules={data.modules}
        nextLessonId={data.nextLessonId}
        previewMode={previewMode}
      />
    </PageContainer>
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
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-muted-foreground text-xs">
      <HugeiconsIcon icon={icon} size={16} />
      <span>{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
