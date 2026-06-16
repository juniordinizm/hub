import {
  Add01Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCourseAction,
  deleteLessonAction,
  deleteModuleAction,
  saveCourseAction,
  saveLessonAction,
  saveModuleAction,
} from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";
import { summarizeCoursePublicationReadiness } from "@/features/courses/presentation";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const lessonTypeOptions = [
  ["video", "Vídeo"],
  ["presentation", "Apresentação"],
  ["bonus", "Bônus"],
] as const;

const providerOptions = [
  ["jmvstream", "JMVStream"],
  ["external", "Externo"],
  ["panda", "Panda"],
] as const;

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
type CourseData = AdminData["courses"][number];
type ModuleData = AdminData["modules"][number];
type LessonData = AdminData["lessons"][number];

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

  const modules = data.modules.filter((item) => item.courseId === course.id);
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
  const paidRevenueInCents = orders
    .filter((order) => order.status === "paid")
    .reduce((total, order) => total + order.amountInCents, 0);
  const certificates = data.certificates.filter(
    (certificate) => certificate.courseId === course.id
  );
  const readiness = summarizeCoursePublicationReadiness({
    hasDescription: Boolean(course.description?.trim()),
    hasPaymentProviderProductId: Boolean(course.paymentProviderProductId),
    hasThumbnail: Boolean(course.thumbnailUrl),
    moduleCount: modules.length,
    publishedLessonCount: publishedLessons.length,
    totalLessonCount: lessons.length,
  });

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Button asChild size="sm" variant="ghost">
          <Link href={route("/admin/cursos")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            Voltar para cursos
          </Link>
        </Button>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline">Curso</Badge>
            <h1 className="mt-3 font-bold text-3xl tracking-tight">
              {course.title}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Organize conteúdo, acompanhe alunos e prepare a publicação deste
              curso.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatPill label="Módulos" value={modules.length.toString()} />
              <StatPill label="Aulas" value={lessons.length.toString()} />
              <StatPill
                label="Alunos"
                value={activeEnrollments.length.toString()}
              />
              <StatPill
                label="Receita"
                value={formatCurrencyInCents(paidRevenueInCents)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={route(`/app/cursos/${course.id}`)}>
                  Preview aluno
                </Link>
              </Button>
              <CourseEditDialog course={course} />
              <DeleteCourseDialog course={course} />
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
              <h2 className="font-semibold">Indicadores do curso</h2>
              <div className="mt-4 space-y-3 text-sm">
                <InfoRow
                  label="Aulas publicadas"
                  value={`${publishedLessons.length} de ${lessons.length}`}
                />
                <InfoRow
                  label="Matrículas ativas"
                  value={activeEnrollments.length.toString()}
                />
                <InfoRow
                  label="Certificados"
                  value={certificates.length.toString()}
                />
                <InfoRow label="Pedidos" value={orders.length.toString()} />
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent className="space-y-6" value="content">
          <section className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
                  Novo módulo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo módulo</DialogTitle>
                  <DialogDescription>
                    Adicione uma unidade ao curso.
                  </DialogDescription>
                </DialogHeader>
                <ModuleForm course={course} />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
                  Nova aula
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova aula</DialogTitle>
                  <DialogDescription>
                    Cadastre uma aula em um dos módulos do curso.
                  </DialogDescription>
                </DialogHeader>
                <LessonForm modules={modules} />
              </DialogContent>
            </Dialog>
          </section>

          <section className="space-y-4">
            <div className="border-b pb-3">
              <h2 className="font-semibold text-xl">Estrutura do curso</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Abra um módulo para editar seus dados. Abra uma aula para editar
                vídeo, ordem e publicação.
              </p>
            </div>
            <div className="space-y-4">
              {modules.map((moduleData) => (
                <ModuleSection
                  course={course}
                  key={moduleData.id}
                  lessons={lessons}
                  moduleData={moduleData}
                  modules={modules}
                />
              ))}
              {modules.length === 0 ? (
                <p className="rounded-lg border bg-card p-5 text-muted-foreground text-sm">
                  Nenhum módulo cadastrado. Comece criando a primeira unidade do
                  curso.
                </p>
              ) : null}
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
                  Dados que aparecem para o aluno e conectam o curso ao checkout
                  externo.
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
                label="Produto AbacatePay"
                value={course.paymentProviderProductId ?? "Não vinculado"}
              />
              <InfoTile
                label="WhatsApp"
                value={course.supportWhatsappUrl ?? "Padrão global"}
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
  );
}

function ModuleSection({
  course,
  lessons,
  moduleData,
  modules,
}: {
  course: CourseData;
  lessons: LessonData[];
  moduleData: ModuleData;
  modules: ModuleData[];
}): React.JSX.Element {
  const moduleLessons = lessons.filter(
    (lesson) => lesson.moduleId === moduleData.id
  );

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            Módulo {moduleData.sortOrder}
          </p>
          <h3 className="font-semibold">{moduleData.title}</h3>
          {moduleData.description ? (
            <p className="mt-1 text-muted-foreground text-sm">
              {moduleData.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{moduleLessons.length} aulas</Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
                Editar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar módulo</DialogTitle>
                <DialogDescription>
                  Atualize os dados deste módulo.
                </DialogDescription>
              </DialogHeader>
              <ModuleForm course={course} moduleData={moduleData} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Separator />
      <div className="divide-y">
        {moduleLessons.length ? (
          moduleLessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} modules={modules} />
          ))
        ) : (
          <p className="px-5 py-4 text-muted-foreground text-sm">
            Nenhuma aula cadastrada neste módulo.
          </p>
        )}
      </div>
    </section>
  );
}

function LessonRow({
  lesson,
  modules,
}: {
  lesson: LessonData;
  modules: ModuleData[];
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 bg-background/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-3 lg:grid-cols-[80px_1fr_160px_110px] lg:items-center">
        <span className="font-mono text-muted-foreground text-xs">
          Aula {lesson.sortOrder}
        </span>
        <div>
          <p className="font-medium">{lesson.title}</p>
          <p className="text-muted-foreground text-xs">
            {lesson.durationMinutes} min · {lesson.videoProvider ?? "sem vídeo"}
          </p>
        </div>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {lesson.videoExternalId ?? "sem hash"}
        </span>
        <Badge
          className="w-fit"
          variant={lesson.isPublished ? "default" : "outline"}
        >
          {lesson.isPublished ? "publicada" : "rascunho"}
        </Badge>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
            Editar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar aula</DialogTitle>
            <DialogDescription>
              Altere vídeo, ordem ou publicação.
            </DialogDescription>
          </DialogHeader>
          <LessonForm lesson={lesson} modules={modules} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseEditDialog({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
          Editar curso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar curso</DialogTitle>
          <DialogDescription>
            Atualize os dados principais do curso.
          </DialogDescription>
        </DialogHeader>
        <CourseForm course={course} />
      </DialogContent>
    </Dialog>
  );
}

function ModuleForm({
  course,
  moduleData,
}: {
  course: CourseData;
  moduleData?: ModuleData;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <AutoCloseDialogForm action={saveModuleAction}>
        <FieldGroup>
          <input name="moduleId" type="hidden" value={moduleData?.id ?? ""} />
          <input name="courseId" type="hidden" value={course.id} />
          <div className="grid gap-4 lg:grid-cols-[1fr_120px_160px]">
            <Field>
              <FieldLabel>Curso</FieldLabel>
              <Input disabled value={course.title} />
            </Field>
            <Field>
              <FieldLabel>Ordem</FieldLabel>
              <Input
                defaultValue={moduleData?.sortOrder ?? 1}
                min={1}
                name="sortOrder"
                required
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel>Cor</FieldLabel>
              <Input
                defaultValue={moduleData?.color ?? "#326c71"}
                name="color"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input
              defaultValue={moduleData?.title ?? ""}
              name="title"
              required
            />
          </Field>
          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              defaultValue={moduleData?.description ?? ""}
              name="description"
            />
          </Field>
          <Button className="w-fit" type="submit">
            <HugeiconsIcon
              icon={moduleData ? FloppyDiskIcon : Add01Icon}
              size={18}
              strokeWidth={2}
            />
            {moduleData ? "Salvar módulo" : "Criar módulo"}
          </Button>
        </FieldGroup>
      </AutoCloseDialogForm>
      {moduleData ? <DeleteModuleDialog moduleData={moduleData} /> : null}
    </div>
  );
}

function LessonForm({
  lesson,
  modules,
}: {
  lesson?: LessonData;
  modules: ModuleData[];
}): React.JSX.Element {
  const publishedFieldId = `lesson-is-published-${lesson?.id ?? "new"}`;

  return (
    <div className="space-y-4">
      <AutoCloseDialogForm action={saveLessonAction}>
        <FieldGroup>
          <input name="lessonId" type="hidden" value={lesson?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-[1fr_120px_120px_120px]">
            <Field>
              <FieldLabel>Módulo</FieldLabel>
              <Select
                defaultValue={lesson?.moduleId ?? modules[0]?.id ?? ""}
                name="moduleId"
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o módulo" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Select
                defaultValue={lesson?.lessonType ?? "video"}
                name="lessonType"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {lessonTypeOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Minutos</FieldLabel>
              <Input
                defaultValue={lesson?.durationMinutes ?? 0}
                min={0}
                name="durationMinutes"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel>Ordem</FieldLabel>
              <Input
                defaultValue={lesson?.sortOrder ?? 1}
                min={1}
                name="sortOrder"
                required
                type="number"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input defaultValue={lesson?.title ?? ""} name="title" required />
          </Field>
          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              defaultValue={lesson?.description ?? ""}
              name="description"
            />
          </Field>
          <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
            <Field>
              <FieldLabel>Provider</FieldLabel>
              <Select
                defaultValue={lesson?.videoProvider ?? "jmvstream"}
                name="videoProvider"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Hash ou ID do vídeo</FieldLabel>
              <Input
                defaultValue={lesson?.videoExternalId ?? ""}
                name="videoExternalId"
                placeholder="video_hash da JMVStream"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>URL ou iframe do player</FieldLabel>
            <Input
              defaultValue={lesson?.videoEmbedUrl ?? ""}
              name="videoEmbedUrl"
              placeholder="https://player.jmvstream.com/... ou iframe oficial"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <label
              className="inline-flex items-center gap-2 text-sm"
              htmlFor={publishedFieldId}
            >
              <Checkbox
                defaultChecked={lesson?.isPublished ?? true}
                id={publishedFieldId}
                name="isPublished"
              />
              Publicada
            </label>
            <Button type="submit">
              <HugeiconsIcon
                icon={lesson ? FloppyDiskIcon : Add01Icon}
                size={18}
                strokeWidth={2}
              />
              {lesson ? "Salvar aula" : "Criar aula"}
            </Button>
          </div>
        </FieldGroup>
      </AutoCloseDialogForm>
      {lesson ? <DeleteLessonDialog lesson={lesson} /> : null}
    </div>
  );
}

function CourseForm({ course }: { course: CourseData }): React.JSX.Element {
  return (
    <AutoCloseDialogForm action={saveCourseAction}>
      <FieldGroup>
        <input name="courseId" type="hidden" value={course.id} />
        <Field>
          <FieldLabel>Título</FieldLabel>
          <Input defaultValue={course.title} name="title" required />
        </Field>
        <Field>
          <FieldLabel>Subtítulo</FieldLabel>
          <Input defaultValue={course.subtitle ?? ""} name="subtitle" />
        </Field>
        <Field>
          <FieldLabel>Descrição</FieldLabel>
          <Textarea
            defaultValue={course.description ?? ""}
            name="description"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Carga horária</FieldLabel>
            <Input
              defaultValue={course.workloadHours ?? 0}
              min={0}
              name="workloadHours"
              type="number"
            />
          </Field>
          <Field>
            <FieldLabel>Meses de acesso</FieldLabel>
            <Input
              defaultValue={course.accessDurationMonths ?? 12}
              min={1}
              name="accessDurationMonths"
              type="number"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>Capa do curso</FieldLabel>
          <Input
            defaultValue={course.thumbnailUrl ?? ""}
            name="thumbnailUrl"
            placeholder="/protear/dash-banner.png"
          />
        </Field>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field>
            <FieldLabel>WhatsApp do curso</FieldLabel>
            <Input
              defaultValue={course.supportWhatsappUrl ?? ""}
              name="supportWhatsappUrl"
            />
          </Field>
          <Field>
            <FieldLabel>Produto AbacatePay</FieldLabel>
            <Input
              defaultValue={course.paymentProviderProductId ?? ""}
              name="paymentProviderProductId"
            />
          </Field>
          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select defaultValue={course.status ?? "draft"} name="status">
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button className="w-fit" type="submit">
          <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
          Salvar curso
        </Button>
      </FieldGroup>
    </AutoCloseDialogForm>
  );
}

function DeleteModuleDialog({
  moduleData,
}: {
  moduleData: ModuleData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir módulo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir módulo?</DialogTitle>
          <DialogDescription>
            Esta ação remove o módulo e, em cascata, todas as aulas e progressos
            vinculados a elas.
          </DialogDescription>
        </DialogHeader>
        <DeleteSummary
          detail={`Módulo ${moduleData.sortOrder}`}
          title={moduleData.title}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteModuleAction}>
            <input name="moduleId" type="hidden" value={moduleData.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLessonDialog({
  lesson,
}: {
  lesson: LessonData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir aula
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir aula?</DialogTitle>
          <DialogDescription>
            Esta ação remove a aula e, em cascata, os progressos vinculados a
            ela.
          </DialogDescription>
        </DialogHeader>
        <DeleteSummary
          detail={`Aula ${lesson.sortOrder}`}
          title={lesson.title}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteLessonAction}>
            <input name="lessonId" type="hidden" value={lesson.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCourseDialog({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir curso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir curso?</DialogTitle>
          <DialogDescription>
            Esta ação remove o curso e, em cascata, seus módulos, aulas,
            matrículas, pedidos e certificados vinculados.
          </DialogDescription>
        </DialogHeader>
        <DeleteSummary
          detail="O identificador interno será preservado apenas no sistema."
          title={course.title}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteCourseAction}>
            <input name="courseId" type="hidden" value={course.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSummary({
  detail,
  title,
}: {
  detail: string;
  title: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
    </div>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold text-lg">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-background/35 p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 break-words font-medium text-sm">{value}</p>
    </div>
  );
}
