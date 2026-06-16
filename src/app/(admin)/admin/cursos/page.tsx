import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
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
  ["Curso", "#curso"],
  ["Adicionar conteudo", "#adicionar"],
  ["Estrutura", "#estrutura"],
] as const;

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();
  const firstCourse = data.courses[0];
  const totalModules = data.modules.length;
  const totalLessons = data.lessons.length;

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
              Ambiente de gestão do conteúdo. O upload dos arquivos permanece no
              painel JMVStream; aqui ficam estrutura, metadados e player.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <StatPill label="Cursos" value={data.courses.length} />
            <StatPill label="Modulos" value={totalModules} />
            <StatPill label="Aulas" value={totalLessons} />
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

      <section className="scroll-mt-20 space-y-4" id="curso">
        <SectionHeading
          description="Dados institucionais, comerciais e de acesso do curso principal."
          eyebrow="01"
          title="Curso"
        />
        <Card>
          <CardContent className="pt-6">
            <form action={saveCourseAction}>
              <FieldGroup>
                <input
                  name="courseId"
                  type="hidden"
                  value={firstCourse?.id ?? ""}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="title">Titulo</FieldLabel>
                    <Input
                      defaultValue={firstCourse?.title ?? ""}
                      id="title"
                      name="title"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="slug">Slug</FieldLabel>
                    <Input
                      defaultValue={firstCourse?.slug ?? ""}
                      id="slug"
                      name="slug"
                      required
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="subtitle">Subtitulo</FieldLabel>
                  <Input
                    defaultValue={firstCourse?.subtitle ?? ""}
                    id="subtitle"
                    name="subtitle"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Descricao</FieldLabel>
                  <Textarea
                    defaultValue={firstCourse?.description ?? ""}
                    id="description"
                    name="description"
                  />
                </Field>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="instructorName">Instrutora</FieldLabel>
                    <Input
                      defaultValue={firstCourse?.instructorName ?? ""}
                      id="instructorName"
                      name="instructorName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="workloadHours">
                      Carga horaria
                    </FieldLabel>
                    <Input
                      defaultValue={firstCourse?.workloadHours ?? 10}
                      id="workloadHours"
                      min={0}
                      name="workloadHours"
                      type="number"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="accessDurationMonths">
                      Meses de acesso
                    </FieldLabel>
                    <Input
                      defaultValue={firstCourse?.accessDurationMonths ?? 12}
                      id="accessDurationMonths"
                      min={1}
                      name="accessDurationMonths"
                      type="number"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="supportWhatsappUrl">
                      WhatsApp do curso
                    </FieldLabel>
                    <Input
                      defaultValue={firstCourse?.supportWhatsappUrl ?? ""}
                      id="supportWhatsappUrl"
                      name="supportWhatsappUrl"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="paymentProviderProductId">
                      Produto AbacatePay
                    </FieldLabel>
                    <Input
                      defaultValue={firstCourse?.paymentProviderProductId ?? ""}
                      id="paymentProviderProductId"
                      name="paymentProviderProductId"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <NativeSelect
                      className="w-full"
                      defaultValue={firstCourse?.status ?? "draft"}
                      id="status"
                      name="status"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativo</option>
                      <option value="archived">Arquivado</option>
                    </NativeSelect>
                  </Field>
                </div>
                <Button className="w-fit" type="submit">
                  Salvar curso
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="scroll-mt-20 space-y-4" id="adicionar">
        <SectionHeading
          description="Use estes blocos apenas quando precisar inserir novo conteúdo."
          eyebrow="02"
          title="Adicionar conteudo"
        />
        <div className="space-y-3">
          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4">
              <div>
                <p className="font-semibold">Novo modulo</p>
                <p className="text-muted-foreground text-sm">
                  Crie uma nova unidade dentro do curso.
                </p>
              </div>
            </summary>
            <Separator />
            <div className="p-5">
              <form action={saveModuleAction}>
                <FieldGroup>
                  <div className="grid gap-4 lg:grid-cols-[1fr_120px_160px]">
                    <Field>
                      <FieldLabel>Curso</FieldLabel>
                      <NativeSelect className="w-full" name="courseId" required>
                        {data.courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel>Ordem</FieldLabel>
                      <Input min={1} name="sortOrder" required type="number" />
                    </Field>
                    <Field>
                      <FieldLabel>Cor</FieldLabel>
                      <Input defaultValue="#326c71" name="color" />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>Titulo</FieldLabel>
                    <Input name="title" required />
                  </Field>
                  <Button className="w-fit" type="submit">
                    Salvar modulo
                  </Button>
                </FieldGroup>
              </form>
            </div>
          </details>

          <details className="rounded-lg border bg-card">
            <summary className="cursor-pointer list-none px-5 py-4">
              <div>
                <p className="font-semibold">Nova aula</p>
                <p className="text-muted-foreground text-sm">
                  Cadastre metadados e o player oficial da JMVStream.
                </p>
              </div>
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
          description="Acompanhe a hierarquia final exibida para as alunas e edite aulas pontuais."
          eyebrow="03"
          title="Estrutura do curso"
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
                <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
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
                <Separator />
                <div className="divide-y">
                  {lessons.length ? (
                    lessons.map((lesson) => (
                      <details className="group" key={lesson.id}>
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

type ModuleOption = Awaited<
  ReturnType<typeof getAdminManagementData>
>["modules"][number];
type LessonData = Awaited<
  ReturnType<typeof getAdminManagementData>
>["lessons"][number];

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

function LessonForm({
  lesson,
  modules,
}: {
  lesson?: LessonData;
  modules: ModuleOption[];
}): React.JSX.Element {
  const publishedFieldId = `lesson-is-published-${lesson?.id ?? "new"}`;

  return (
    <form action={saveLessonAction}>
      <FieldGroup>
        <input name="lessonId" type="hidden" value={lesson?.id ?? ""} />
        <div className="grid gap-4 lg:grid-cols-[1fr_120px_120px_120px]">
          <Field>
            <FieldLabel>Modulo</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={lesson?.moduleId ?? modules[0]?.id}
              name="moduleId"
              required
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.courseTitle} - {module.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <NativeSelect
              className="w-full"
              defaultValue={lesson?.lessonType ?? "video"}
              name="lessonType"
            >
              {lessonTypeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
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
            <NativeSelect
              className="w-full"
              defaultValue={lesson?.videoProvider ?? "jmvstream"}
              name="videoProvider"
            >
              {providerOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
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
          <Button type="submit">{lesson ? "Salvar aula" : "Criar aula"}</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
