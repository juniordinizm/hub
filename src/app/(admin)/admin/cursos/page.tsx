import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

export const dynamic = "force-dynamic";

const lessonTypeOptions = [
  ["video", "Video"],
  ["presentation", "Apresentacao"],
  ["bonus", "Bonus"],
] as const;

const providerOptions = [
  ["jmvstream", "JMVStream"],
  ["external", "Externo"],
  ["panda", "Panda"],
] as const;

const sectionLinks = [
  ["Cursos", "#cursos"],
  ["Adicionar", "#adicionar"],
  ["Estrutura", "#estrutura"],
] as const;

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
type CourseData = AdminData["courses"][number];
type ModuleData = AdminData["modules"][number];
type LessonData = AdminData["lessons"][number];

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Badge variant="outline">Catalogo</Badge>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Cursos, modulos e aulas
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Gestão formal do conteúdo. Estrutura, metadados e player ficam no
              Hub; upload de arquivo permanece no painel JMVStream.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Cursos" value={data.courses.length} />
            <StatPill label="Modulos" value={data.modules.length} />
            <StatPill label="Aulas" value={data.lessons.length} />
          </div>
        </div>
      </header>

      <nav
        aria-label="Secoes do catalogo"
        className="flex flex-wrap gap-2 border-b pb-5"
      >
        {sectionLinks.map(([label, href]) => (
          <Button asChild key={href} size="sm" variant="secondary">
            <a href={href}>{label}</a>
          </Button>
        ))}
      </nav>

      <section className="scroll-mt-20 space-y-4" id="cursos">
        <SectionHeading
          description="Edite, crie ou remova cursos. A exclusão pode ser bloqueada pelo banco se houver matrículas, pedidos ou certificados relacionados."
          eyebrow="01"
          title="Cursos"
        />
        <div className="space-y-3">
          {data.courses.map((course) => (
            <details className="rounded-lg border bg-card" key={course.id}>
              <summary className="cursor-pointer list-none px-5 py-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <h2 className="font-semibold">{course.title}</h2>
                    <p className="text-muted-foreground text-sm">
                      {course.slug} - {course.accessDurationMonths} meses
                    </p>
                  </div>
                  <Badge variant="secondary">{course.status}</Badge>
                </div>
              </summary>
              <Separator />
              <div className="p-5">
                <CourseForm course={course} />
              </div>
            </details>
          ))}
          <details
            className="rounded-lg border bg-card"
            open={!data.courses.length}
          >
            <summary className="cursor-pointer list-none px-5 py-4">
              <p className="font-semibold">Novo curso</p>
              <p className="text-muted-foreground text-sm">
                Adicione outro curso ao Hub.
              </p>
            </summary>
            <Separator />
            <div className="p-5">
              <CourseForm />
            </div>
          </details>
        </div>
      </section>

      <section className="scroll-mt-20 space-y-4" id="adicionar">
        <SectionHeading
          description="Blocos recolhíveis para inserção de novos módulos e aulas."
          eyebrow="02"
          title="Adicionar conteudo"
        />
        <div className="space-y-3">
          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4">
              <p className="font-semibold">Novo modulo</p>
              <p className="text-muted-foreground text-sm">
                Crie uma unidade dentro de um curso.
              </p>
            </summary>
            <Separator />
            <div className="p-5">
              <ModuleForm courses={data.courses} />
            </div>
          </details>
          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4">
              <p className="font-semibold">Nova aula</p>
              <p className="text-muted-foreground text-sm">
                Cadastre metadados e o player oficial da JMVStream.
              </p>
            </summary>
            <Separator />
            <div className="p-5">
              <LessonForm modules={data.modules} />
            </div>
          </details>
        </div>
      </section>

      <section className="scroll-mt-20 space-y-4" id="estrutura">
        <SectionHeading
          description="Hierarquia final exibida para as alunas, com edição por módulo e por aula."
          eyebrow="03"
          title="Estrutura"
        />
        <div className="space-y-4">
          {data.modules.map((moduleData) => {
            const lessons = data.lessons.filter(
              (lesson) => lesson.moduleId === moduleData.id
            );

            return (
              <section
                className="rounded-lg border bg-card"
                key={moduleData.id}
              >
                <details>
                  <summary className="cursor-pointer list-none px-5 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {moduleData.courseTitle}
                        </p>
                        <h2 className="font-semibold">{moduleData.title}</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          Modulo {moduleData.sortOrder}
                        </Badge>
                        <Badge variant="outline">{lessons.length} aulas</Badge>
                      </div>
                    </div>
                  </summary>
                  <Separator />
                  <div className="bg-background/30 p-5">
                    <ModuleForm
                      courses={data.courses}
                      moduleData={moduleData}
                    />
                  </div>
                </details>
                <Separator />
                <div className="divide-y">
                  {lessons.length ? (
                    lessons.map((lesson) => (
                      <details key={lesson.id}>
                        <summary className="cursor-pointer list-none px-5 py-4">
                          <div className="grid gap-3 lg:grid-cols-[80px_1fr_160px_110px] lg:items-center">
                            <span className="font-mono text-muted-foreground text-xs">
                              Aula {lesson.sortOrder}
                            </span>
                            <div>
                              <p className="font-medium">{lesson.title}</p>
                              <p className="text-muted-foreground text-xs">
                                {lesson.durationMinutes} min -{" "}
                                {lesson.videoProvider ?? "sem video"}
                              </p>
                            </div>
                            <span className="truncate font-mono text-muted-foreground text-xs">
                              {lesson.videoExternalId ?? "sem hash"}
                            </span>
                            <Badge
                              className="w-fit"
                              variant={
                                lesson.isPublished ? "default" : "outline"
                              }
                            >
                              {lesson.isPublished ? "publicada" : "rascunho"}
                            </Badge>
                          </div>
                        </summary>
                        <div className="border-t bg-background/35 p-5">
                          <LessonForm lesson={lesson} modules={data.modules} />
                        </div>
                      </details>
                    ))
                  ) : (
                    <p className="px-5 py-4 text-muted-foreground text-sm">
                      Nenhuma aula cadastrada neste modulo.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CourseForm({ course }: { course?: CourseData }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <form action={saveCourseAction}>
        <FieldGroup>
          <input name="courseId" type="hidden" value={course?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Field>
              <FieldLabel>Titulo</FieldLabel>
              <Input defaultValue={course?.title ?? ""} name="title" required />
            </Field>
            <Field>
              <FieldLabel>Slug</FieldLabel>
              <Input defaultValue={course?.slug ?? ""} name="slug" required />
            </Field>
          </div>
          <Field>
            <FieldLabel>Subtitulo</FieldLabel>
            <Input defaultValue={course?.subtitle ?? ""} name="subtitle" />
          </Field>
          <Field>
            <FieldLabel>Descricao</FieldLabel>
            <Textarea
              defaultValue={course?.description ?? ""}
              name="description"
            />
          </Field>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel>Instrutora</FieldLabel>
              <Input
                defaultValue={course?.instructorName ?? ""}
                name="instructorName"
              />
            </Field>
            <Field>
              <FieldLabel>Carga horaria</FieldLabel>
              <Input
                defaultValue={course?.workloadHours ?? 0}
                min={0}
                name="workloadHours"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel>Meses de acesso</FieldLabel>
              <Input
                defaultValue={course?.accessDurationMonths ?? 12}
                min={1}
                name="accessDurationMonths"
                type="number"
              />
            </Field>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel>WhatsApp do curso</FieldLabel>
              <Input
                defaultValue={course?.supportWhatsappUrl ?? ""}
                name="supportWhatsappUrl"
              />
            </Field>
            <Field>
              <FieldLabel>Produto AbacatePay</FieldLabel>
              <Input
                defaultValue={course?.paymentProviderProductId ?? ""}
                name="paymentProviderProductId"
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select defaultValue={course?.status ?? "draft"} name="status">
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
            {course ? "Salvar curso" : "Criar curso"}
          </Button>
        </FieldGroup>
      </form>
      {course ? (
        <form action={deleteCourseAction}>
          <input name="courseId" type="hidden" value={course.id} />
          <Button size="sm" type="submit" variant="destructive">
            Excluir curso
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function ModuleForm({
  courses,
  moduleData,
}: {
  courses: CourseData[];
  moduleData?: ModuleData;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <form action={saveModuleAction}>
        <FieldGroup>
          <input name="moduleId" type="hidden" value={moduleData?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-[1fr_120px_160px]">
            <Field>
              <FieldLabel>Curso</FieldLabel>
              <Select
                defaultValue={moduleData?.courseId ?? courses[0]?.id ?? ""}
                name="courseId"
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <FieldLabel>Titulo</FieldLabel>
            <Input
              defaultValue={moduleData?.title ?? ""}
              name="title"
              required
            />
          </Field>
          <Field>
            <FieldLabel>Descricao</FieldLabel>
            <Textarea
              defaultValue={moduleData?.description ?? ""}
              name="description"
            />
          </Field>
          <Button className="w-fit" type="submit">
            {moduleData ? "Salvar modulo" : "Criar modulo"}
          </Button>
        </FieldGroup>
      </form>
      {moduleData ? (
        <form action={deleteModuleAction}>
          <input name="moduleId" type="hidden" value={moduleData.id} />
          <Button size="sm" type="submit" variant="destructive">
            Excluir modulo
          </Button>
        </form>
      ) : null}
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
      <form action={saveLessonAction}>
        <FieldGroup>
          <input name="lessonId" type="hidden" value={lesson?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-[1fr_120px_120px_120px]">
            <Field>
              <FieldLabel>Modulo</FieldLabel>
              <Select
                defaultValue={lesson?.moduleId ?? modules[0]?.id ?? ""}
                name="moduleId"
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modulo" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.courseTitle} - {module.title}
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
            <FieldLabel>Titulo</FieldLabel>
            <Input defaultValue={lesson?.title ?? ""} name="title" required />
          </Field>
          <Field>
            <FieldLabel>Descricao</FieldLabel>
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
              <FieldLabel>Hash ou ID do video</FieldLabel>
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
              {lesson ? "Salvar aula" : "Criar aula"}
            </Button>
          </div>
        </FieldGroup>
      </form>
      {lesson ? (
        <form action={deleteLessonAction}>
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button size="sm" type="submit" variant="destructive">
            Excluir aula
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold text-xl">{value}</p>
    </div>
  );
}

function SectionHeading({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}): React.JSX.Element {
  return (
    <div className="grid gap-2 border-b pb-3 lg:grid-cols-[120px_1fr]">
      <p className="font-mono text-muted-foreground text-xs">{eyebrow}</p>
      <div>
        <h2 className="font-semibold text-xl">{title}</h2>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
