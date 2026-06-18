import { Add01Icon, FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
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
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type CourseData = Awaited<
  ReturnType<typeof getAdminManagementData>
>["courses"][number];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: {
    label: "Ativo",
    color:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  draft: {
    label: "Rascunho",
    color:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  archived: {
    label: "Arquivado",
    color: "border-zinc-500/30 bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
};

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <Badge variant="outline">Catálogo</Badge>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-bold text-3xl tracking-tight">Cursos</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                Gerencie cursos em uma visão limpa. Entre em um curso para
                organizar módulos, aulas, alunos e publicação.
              </p>
            </div>
            <Dialog>
              <DialogTriggerButton>
                <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
                Novo curso
              </DialogTriggerButton>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo curso</DialogTitle>
                  <DialogDescription>
                    Crie o curso antes de cadastrar seus módulos e aulas.
                  </DialogDescription>
                </DialogHeader>
                <CourseForm />
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <section className="flex flex-wrap gap-5">
          {data.courses.map((course) => {
            const courseModules = data.modules.filter(
              (moduleData) => moduleData.courseId === course.id
            );
            const lessonsCount = data.lessons.filter((lesson) =>
              courseModules.some(
                (moduleData) => moduleData.id === lesson.moduleId
              )
            ).length;
            const statusInfo = STATUS_MAP[course.status] ?? {
              label: course.status,
              color: "border-zinc-500/30 bg-zinc-500/15 text-zinc-600",
            };

            return (
              <article
                className="group relative flex w-full max-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-sidebar text-sidebar-foreground shadow-sm transition-all hover:border-primary/50"
                key={course.id}
              >
                <div className="absolute inset-0 z-0">
                  {course.thumbnailUrl ? (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-center bg-cover opacity-40 transition-transform duration-500 group-hover:scale-105"
                      style={{
                        backgroundImage: `url(${course.thumbnailUrl})`,
                      }}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar/95 to-primary/20" />
                      <div className="absolute top-[20%] -right-4 select-none opacity-10 transition-transform duration-500 group-hover:scale-105">
                        <span className="font-black text-[8rem] leading-none tracking-tighter">
                          {getInitials(course.title)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sidebar/80 to-sidebar" />
                </div>

                <div className="relative z-10 flex min-h-[260px] flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <Badge className={statusInfo.color} variant="outline">
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="mt-auto pt-10">
                    <h3 className="line-clamp-2 font-bold text-lg">
                      <Link
                        className="before:absolute before:inset-0"
                        href={route(`/admin/cursos/${course.id}`)}
                      >
                        {course.title}
                      </Link>
                    </h3>
                    <div className="mt-2 flex items-start gap-4">
                      <div className="flex-1">
                        {course.subtitle ? (
                          <p className="line-clamp-2 text-sidebar-foreground/70 text-sm leading-5">
                            {course.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 pt-0.5 text-right font-medium text-sidebar-foreground/60 text-xs">
                        {courseModules.length} módulos • {lessonsCount} aulas
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span>{course.accessDurationMonths}m acesso</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrencyInCents(course.priceInCents)}
                    </span>
                  </div>

                  <Button
                    asChild
                    className="w-full"
                    size="sm"
                    variant="secondary"
                  >
                    <Link href={route(`/admin/cursos/${course.id}`)}>
                      Gerenciar curso
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function CourseForm({ course }: { course?: CourseData }): React.JSX.Element {
  return (
    <AutoCloseDialogForm action={saveCourseAction}>
      <FieldGroup>
        <input name="courseId" type="hidden" value={course?.id ?? ""} />
        <Field>
          <FieldLabel>Título</FieldLabel>
          <Input defaultValue={course?.title ?? ""} name="title" required />
        </Field>
        <Field>
          <FieldLabel>Subtítulo</FieldLabel>
          <Input defaultValue={course?.subtitle ?? ""} name="subtitle" />
        </Field>
        <Field>
          <FieldLabel>Descrição</FieldLabel>
          <Textarea
            defaultValue={course?.description ?? ""}
            name="description"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Carga horária</FieldLabel>
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
        <Field>
          <FieldLabel>Preço do curso</FieldLabel>
          <Input
            defaultValue={
              course ? formatCurrencyInCents(course.priceInCents) : ""
            }
            disabled={Boolean(course)}
            name="price"
            placeholder="497,00"
            required={!course}
          />
        </Field>
        <Field>
          <FieldLabel>Capa do curso</FieldLabel>
          <Input
            defaultValue={course?.thumbnailUrl ?? ""}
            name="thumbnailUrl"
            placeholder="/protear/dash-banner.png"
          />
        </Field>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field>
            <FieldLabel>Produto AbacatePay</FieldLabel>
            <Input
              defaultValue={course?.paymentProviderProductId ?? ""}
              disabled
              placeholder="Gerado automaticamente ao criar"
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
          <HugeiconsIcon
            icon={course ? FloppyDiskIcon : Add01Icon}
            size={18}
            strokeWidth={2}
          />
          {course ? "Salvar curso" : "Criar curso"}
        </Button>
      </FieldGroup>
    </AutoCloseDialogForm>
  );
}
