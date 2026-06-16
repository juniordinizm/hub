import { Add01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  deleteLessonAction,
  deleteModuleAction,
  saveLessonAction,
  saveModuleAction,
} from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";
import { route } from "@/lib/routes";

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

  const modules = data.modules.filter(
    (moduleData) => moduleData.courseId === course.id
  );
  const lessons = data.lessons.filter((lesson) =>
    modules.some((moduleData) => moduleData.id === lesson.moduleId)
  );

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Button asChild size="sm" variant="ghost">
          <Link href={route("/admin/cursos")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            Voltar para cursos
          </Link>
        </Button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline">Curso</Badge>
            <h1 className="mt-3 font-bold text-3xl tracking-tight">
              {course.title}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Organize módulos e aulas deste curso específico.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Modulos" value={modules.length} />
            <StatPill label="Aulas" value={lessons.length} />
          </div>
        </div>
      </header>

      <section className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
              Novo modulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo modulo</DialogTitle>
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
                Cadastre uma aula em um dos modulos do curso.
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
          {modules.map((moduleData) => {
            const moduleLessons = lessons.filter(
              (lesson) => lesson.moduleId === moduleData.id
            );

            return (
              <section
                className="rounded-lg border bg-card"
                key={moduleData.id}
              >
                <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Modulo {moduleData.sortOrder}
                    </p>
                    <h3 className="font-semibold">{moduleData.title}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {moduleLessons.length} aulas
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary">
                          Editar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar modulo</DialogTitle>
                          <DialogDescription>
                            Atualize os dados deste modulo.
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
                      <div
                        className="flex flex-col gap-3 bg-background/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                        key={lesson.id}
                      >
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
                            variant={lesson.isPublished ? "default" : "outline"}
                          >
                            {lesson.isPublished ? "publicada" : "rascunho"}
                          </Badge>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar aula</DialogTitle>
                              <DialogDescription>
                                Altere video, ordem ou publique.
                              </DialogDescription>
                            </DialogHeader>
                            <LessonForm lesson={lesson} modules={modules} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))
                  ) : (
                    <p className="px-5 py-4 text-muted-foreground text-sm">
                      Nenhuma aula cadastrada neste módulo.
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

function ModuleForm({
  course,
  moduleData,
}: {
  course: CourseData;
  moduleData?: ModuleData;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <form action={saveModuleAction}>
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
      {lesson ? <DeleteLessonDialog lesson={lesson} /> : null}
    </div>
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
          Excluir modulo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir modulo?</DialogTitle>
          <DialogDescription>
            Esta acao remove o modulo e, em cascata, todas as aulas e progressos
            vinculados a elas.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="font-semibold">{moduleData.title}</p>
          <p className="text-muted-foreground text-sm">
            Modulo {moduleData.sortOrder}
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteModuleAction}>
            <input name="moduleId" type="hidden" value={moduleData.id} />
            <Button type="submit" variant="destructive">
              Confirmar exclusao
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
          Excluir aula
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir aula?</DialogTitle>
          <DialogDescription>
            Esta acao remove a aula e, em cascata, os progressos vinculados a
            ela.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="font-semibold">{lesson.title}</p>
          <p className="text-muted-foreground text-sm">
            Aula {lesson.sortOrder}
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteLessonAction}>
            <input name="lessonId" type="hidden" value={lesson.id} />
            <Button type="submit" variant="destructive">
              Confirmar exclusao
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
