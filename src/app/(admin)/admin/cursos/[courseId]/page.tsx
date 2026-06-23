import {
  Certificate01Icon,
  Clock01Icon,
  ShoppingCart01Icon,
  UserMultipleIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminCourseContentSignal,
  summarizeAdminCourseContent,
} from "@/features/admin/presentation";
import { getAdminManagementData } from "@/features/admin/server";
import {
  formatCourseWorkload,
  summarizeCoursePublicationReadiness,
} from "@/features/courses/presentation";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import {
  CourseBuilderWrapper,
  CourseMetricCard,
  CreateModuleDialog,
  InfoRow,
} from "./course-builder-components";
import {
  CourseSettingsForm,
  DeleteCourseDialog,
} from "./course-dialogs-client";

export const dynamic = "force-dynamic";

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<React.JSX.Element> {
  const [{ courseId }, data] = await Promise.all([
    params,
    getAdminManagementData(),
  ]);
  const course = data.courses.find((item) => item.id === courseId);

  if (!course) {
    notFound();
  }

  const modules = data.modules
    .filter((item) => item.courseId === course.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const lessons = data.lessons.filter((lesson) =>
    modules.some((moduleData) => moduleData.id === lesson.moduleId)
  );
  const publishedLessons = lessons.filter((lesson) => lesson.isPublished);
  const enrollments = data.enrollments.filter(
    (enrollment) => enrollment.courseId === course.id
  );
  const activeEnrollments = enrollments.filter(
    (enrollment) => enrollment.status === "active"
  );
  const orders = data.orders.filter((order) => order.courseId === course.id);
  const certificates = data.certificates.filter(
    (certificate) => certificate.courseId === course.id
  );
  const contentSummary = summarizeAdminCourseContent({ lessons, modules });
  const contentSignal = getAdminCourseContentSignal(contentSummary);
  const readiness = summarizeCoursePublicationReadiness({
    hasDescription: Boolean(course.description?.trim()),
    hasPaymentProviderProductId: Boolean(course.paymentProviderProductId),
    hasThumbnail: Boolean(course.thumbnailUrl),
    moduleCount: modules.length,
    publishedLessonCount: publishedLessons.length,
    totalLessonCount: lessons.length,
  });
  const nextModuleSortOrder =
    modules.length > 0 ? Math.max(...modules.map((m) => m.sortOrder)) + 1 : 1;

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-6 border-b pb-6">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
                  {course.title}
                </h1>
                <Badge
                  variant={
                    contentSignal.tone === "attention"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {contentSignal.label}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                {course.subtitle ||
                  "Nenhum subtítulo cadastrado para este curso."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Button asChild size="sm" variant="outline">
                <a href={route(`/app/cursos/${course.id}?preview=student`)}>
                  <HugeiconsIcon
                    className="mr-2"
                    icon={ViewIcon}
                    size={16}
                    strokeWidth={2}
                  />
                  Ver como aluno
                </a>
              </Button>
              <DeleteCourseDialog course={course} />
            </div>
          </div>
        </header>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="students">Alunos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="overview">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CourseMetricCard
                helper="Alunos com acesso liberado."
                icon={UserMultipleIcon}
                label="Matrículas ativas"
                value={activeEnrollments.length.toString()}
              />
              <CourseMetricCard
                helper="Vendas totais do curso."
                icon={ShoppingCart01Icon}
                label="Pedidos aprovados"
                value={orders.length.toString()}
              />
              <CourseMetricCard
                helper="Alunos que concluíram o curso."
                icon={Certificate01Icon}
                label="Certificados"
                value={certificates.length.toString()}
              />
              <CourseMetricCard
                helper="Duração total das aulas em vídeo."
                icon={Clock01Icon}
                label="Carga horária"
                value={formatCourseWorkload(
                  contentSummary.totalDurationSeconds
                )}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-xl">
                      Prontidão de publicação
                    </h2>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Checklist mínimo para o curso parecer vendável e completo.
                    </p>
                  </div>
                  <Badge
                    variant={course.status === "active" ? "default" : "outline"}
                  >
                    {course.status}
                  </Badge>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-sm">
                    {readiness.completedCount} de {readiness.totalCount} itens
                  </span>
                  <span className="font-semibold">{readiness.percent}%</span>
                </div>
                <Progress className="mt-3 h-2" value={readiness.percent} />
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {readiness.missingItems.length ? (
                    readiness.missingItems.map((item) => (
                      <p
                        className="rounded-md border bg-background/35 px-3 py-2 text-sm"
                        key={item}
                      >
                        {item}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-md border bg-background/35 px-3 py-2 text-sm">
                      Curso pronto para venda e consumo.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <h2 className="font-semibold">Status do conteúdo</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  {contentSignal.helper}
                </p>
                <div className="mt-4 flex flex-col gap-3 text-sm">
                  <InfoRow
                    label="Aulas publicadas"
                    value={`${contentSummary.publishedLessons} de ${contentSummary.totalLessons}`}
                  />
                  <InfoRow
                    label="Aulas com conteúdo"
                    value={`${contentSummary.readyLessons} de ${contentSummary.totalLessons}`}
                  />
                  <InfoRow
                    label="Módulos cadastrados"
                    value={modules.length.toString()}
                  />
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent className="space-y-6" value="content">
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-xl">Estrutura do curso</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Abra um módulo para editar seus dados. Abra uma aula para
                    editar vídeo, ordem e publicação.
                  </p>
                </div>
                <CreateModuleDialog
                  course={course}
                  nextModuleSortOrder={nextModuleSortOrder}
                />
              </div>
              <div className="flex flex-col gap-4">
                {modules.length === 0 ? (
                  <p className="rounded-lg border bg-card p-5 text-muted-foreground text-sm">
                    Nenhum módulo cadastrado. Comece criando a primeira unidade
                    do curso.
                  </p>
                ) : (
                  <CourseBuilderWrapper
                    course={course}
                    lessons={lessons}
                    modules={modules}
                  />
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent className="space-y-5" value="students">
            <section className="rounded-lg border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-xl">Alunos deste curso</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Últimas matrículas e situação de acesso.
                </p>
              </div>
              <div className="divide-y">
                {enrollments.map((enrollment) => (
                  <div
                    className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_130px_170px]"
                    key={enrollment.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{enrollment.name}</p>
                      <p className="truncate text-muted-foreground text-sm">
                        {enrollment.email}
                      </p>
                    </div>
                    <Badge className="w-fit" variant="outline">
                      {enrollment.status}
                    </Badge>
                    <p className="text-muted-foreground text-sm">
                      Expira em {formatDate(enrollment.expiresAt)}
                    </p>
                  </div>
                ))}
                {enrollments.length === 0 ? (
                  <p className="px-5 py-4 text-muted-foreground text-sm">
                    Nenhuma matrícula encontrada para este curso.
                  </p>
                ) : null}
              </div>
            </section>
          </TabsContent>

          <TabsContent className="space-y-5" value="settings">
            <section className="rounded-lg border bg-card p-5">
              <div className="mb-6 border-b pb-4">
                <h2 className="font-semibold text-xl">
                  Configurações do curso
                </h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Dados que aparecem para o aluno e conectam o curso ao checkout
                  externo.
                </p>
              </div>
              <CourseSettingsForm
                course={course}
                totalDurationSeconds={contentSummary.totalDurationSeconds}
              />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
