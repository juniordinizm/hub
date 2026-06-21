import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminCourseContentSignal,
  summarizeAdminCourseContent,
} from "@/features/admin/presentation";
import { getAdminManagementData } from "@/features/admin/server";
import { summarizeCoursePublicationReadiness } from "@/features/courses/presentation";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { CourseActionsDropdown } from "./course-actions-dropdown";
import {
  CourseBuilderWrapper,
  CourseMetricCard,
  CreateModuleDialog,
  InfoRow,
  InfoTile,
} from "./course-builder-components";
import { CourseEditDialog } from "./course-dialogs-client";

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
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Badge variant="outline">Curso</Badge>
              <h1 className="mt-3 font-bold text-3xl tracking-tight">
                {course.title}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant={
                    contentSignal.tone === "attention"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {contentSignal.label}
                </Badge>
                <Badge variant="outline">
                  {formatLessonDuration(contentSummary.totalDurationSeconds)}
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                Organize conteúdo, acompanhe alunos e prepare a publicação deste
                curso.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
                <span>
                  {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
                </span>
                <span>·</span>
                <span>
                  {lessons.length} {lessons.length === 1 ? "aula" : "aulas"}
                </span>
                <span>·</span>
                <span>
                  {activeEnrollments.length}{" "}
                  {activeEnrollments.length === 1
                    ? "aluno ativo"
                    : "alunos ativos"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CourseActionsDropdown course={course} />
              </div>
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
                label="Matrículas ativas"
                value={activeEnrollments.length.toString()}
              />
              <CourseMetricCard
                helper="Vendas totais do curso."
                label="Pedidos aprovados"
                value={orders.length.toString()}
              />
              <CourseMetricCard
                helper="Alunos que concluíram o curso."
                label="Certificados"
                value={certificates.length.toString()}
              />
              <CourseMetricCard
                helper="Duração total das aulas em vídeo."
                label="Carga horária"
                value={formatLessonDuration(
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
                    label="Aulas com vídeo"
                    value={`${contentSummary.videoReadyLessons} de ${contentSummary.totalLessons}`}
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
                    jmvstreamAssets={data.jmvstreamAssets}
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-xl">
                    Configurações do curso
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Dados que aparecem para o aluno e conectam o curso ao
                    checkout externo.
                  </p>
                </div>
                <CourseEditDialog course={course} />
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <InfoTile
                  label="Capa"
                  value={course.thumbnailUrl ?? "Não cadastrada"}
                />
                <InfoTile
                  label="Preço"
                  value={formatCurrencyInCents(course.priceInCents)}
                />
                <InfoTile
                  label="Produto AbacatePay"
                  value={course.paymentProviderProductId ?? "Não vinculado"}
                />
                <InfoTile
                  label="Meses de acesso"
                  value={`${course.accessDurationMonths} meses`}
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
