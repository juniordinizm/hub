import { BookOpen01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { RegisterPreviewCourseId } from "@/components/panel-layout";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { APP_TIME_ZONE } from "@/lib/timezone";
import { PendingCertificateRefresh } from "../../certificados/pending-certificate-refresh";
import { CourseOverviewClient } from "./course-overview-client";

export const dynamic = "force-dynamic";

function getCourseButtonLabel(progressPercent: number): string {
  if (progressPercent === 0) {
    return "Iniciar curso";
  }
  return "Rever trilha";
}

const formatReleaseDate = (value: Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(value);

function getIncompleteCertificateDescription({
  completedCount,
  studentName,
  totalCount,
}: {
  completedCount: number;
  studentName: string | null;
  totalCount: number;
}): string {
  const remainingLessons = Math.max(0, totalCount - completedCount);
  const lessonLabel =
    remainingLessons === 1
      ? "Falta 1 aula obrigatória."
      : `Faltam ${remainingLessons} aulas obrigatórias.`;
  const expectedName = studentName
    ? ` O nome previsto é ${studentName}.`
    : " O certificado usará o nome do perfil da Aluna.";

  return `${lessonLabel}${expectedName}`;
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

  const totalDurationSeconds = data.modules.reduce(
    (acc, moduleData) => acc + moduleData.totalDurationSeconds,
    0
  );
  let primaryAction: React.JSX.Element;
  if (data.certificateCode) {
    primaryAction = (
      <Button asChild className="h-full w-full px-6 sm:w-auto" size="sm">
        <Link href={route(`/certificados/${data.certificateCode}`)}>
          Ver certificado
        </Link>
      </Button>
    );
  } else if (data.nextReleaseAt && !data.nextLessonId) {
    primaryAction = (
      <Button className="h-full w-full px-6 sm:w-auto" disabled size="sm">
        Próximo módulo em {formatReleaseDate(data.nextReleaseAt)}
      </Button>
    );
  } else {
    primaryAction = (
      <Button asChild className="h-full w-full px-6 sm:w-auto" size="sm">
        <Link
          href={route(
            getPreviewAwareHref(
              getStudentCoursePrimaryHref({
                courseId: data.course.id,
                nextLessonId: data.nextLessonId,
              }),
              previewMode
            )
          )}
        >
          {getCourseButtonLabel(data.progressPercent)}
        </Link>
      </Button>
    );
  }

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

                <div className="flex shrink-0">{primaryAction}</div>
              </div>
            </div>
          </header>
          {data.certificateEnabled ? (
            <CourseCertificatePanel
              certificateCode={data.certificateCode}
              certificateRenderStatus={data.certificateRenderStatus}
              certificateStatus={data.certificateStatus}
              completedCount={data.completedCount}
              courseTitle={data.course.title}
              studentName={data.studentName}
              totalCount={data.totalCount}
            />
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

function CourseCertificatePanel({
  certificateCode,
  certificateRenderStatus,
  certificateStatus,
  completedCount,
  courseTitle,
  studentName,
  totalCount,
}: {
  certificateCode: string | null;
  certificateRenderStatus: "failed" | "pending" | "ready" | null;
  certificateStatus: "revoked" | "valid" | null;
  completedCount: number;
  courseTitle: string;
  studentName: string | null;
  totalCount: number;
}): React.JSX.Element {
  const titleId = "course-certificate-title";

  if (!certificateCode) {
    return (
      <Card aria-labelledby={titleId} role="region">
        <CardHeader>
          <CardTitle as="h2" id={titleId}>
            Certificado de conclusão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-muted-foreground leading-6">
            {getIncompleteCertificateDescription({
              completedCount,
              studentName,
              totalCount,
            })}
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild size="sm" variant="outline">
            <Link href={route("/app/configuracoes")}>
              Conferir nome no perfil
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (certificateStatus === "revoked") {
    return (
      <Card aria-labelledby={titleId} role="region">
        <CardHeader>
          <CardTitle as="h2" id={titleId}>
            Certificado revogado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Este certificado não está mais válido</AlertTitle>
            <AlertDescription>
              Consulte o registro público para ver o status atual deste
              certificado.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={route(`/certificados/${certificateCode}`)}>
              Ver certificado
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (certificateRenderStatus === "ready") {
    return (
      <Card aria-labelledby={titleId} role="region">
        <CardHeader>
          <CardTitle as="h2" id={titleId}>
            Seu certificado está pronto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert aria-live="polite" role="status">
            <AlertTitle>Conquista concluída</AlertTitle>
            <AlertDescription>
              Seu certificado já pode ser consultado e compartilhado.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href={route(`/certificados/${certificateCode}`)}>
              Ver certificado
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (certificateRenderStatus === "failed") {
    return (
      <Card aria-labelledby={titleId} role="region">
        <CardHeader>
          <CardTitle as="h2" id={titleId}>
            Certificado precisa de suporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Falha no preparo do PDF</AlertTitle>
            <AlertDescription>
              Seu curso continua concluído. Fale com o suporte para receber
              ajuda com o certificado.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <SupportRequestDialog
            courseTitle={courseTitle}
            triggerLabel="Falar com suporte"
            triggerSize="sm"
          />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card aria-labelledby={titleId} role="region">
      <CardHeader>
        <CardTitle as="h2" id={titleId}>
          Certificado em preparação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert aria-live="polite" role="status">
          <AlertTitle>Conclusão registrada</AlertTitle>
          <AlertDescription>
            Estamos preparando o PDF do seu certificado. Esta página atualiza o
            status automaticamente enquanto estiver visível.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <PendingCertificateRefresh enabled showManualRefresh />
      </CardFooter>
    </Card>
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
