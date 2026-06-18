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
      <div className="space-y-8">
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

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/50"
                key={course.id}
              >
                {/* Top Cover */}
                <div className="relative flex min-h-[220px] flex-col overflow-hidden bg-[#122425] p-5 pb-6">
                  <div className="absolute right-0 bottom-4 -mr-4 select-none opacity-[0.03] transition-opacity group-hover:opacity-[0.05]">
                    <span className="font-black text-[8rem] leading-none">
                      {getInitials(course.title)}
                    </span>
                  </div>

                  <div className="relative z-10 mb-8 flex items-center justify-between">
                    <Badge
                      className="w-fit border-transparent bg-white/10 text-white backdrop-blur-sm"
                      variant="outline"
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="relative z-10 mt-auto">
                    <h3 className="line-clamp-2 font-bold text-white text-xl">
                      {course.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-medium text-white/70 text-xs">
                      <span>{courseModules.length} módulos</span>
                      <span className="text-white/30">·</span>
                      <span>{lessonsCount} aulas</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Body */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="mb-5 flex flex-col gap-3">
                    {course.subtitle ? (
                      <p className="line-clamp-2 text-muted-foreground text-sm leading-6">
                        {course.subtitle}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 font-medium text-muted-foreground text-xs">
                      <span>{course.accessDurationMonths}m acesso</span>
                      <span className="text-foreground/20">·</span>
                      <span>{formatCurrencyInCents(course.priceInCents)}</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Button
                      asChild
                      className="w-full"
                      size="sm"
                      variant="outline"
                    >
                      <Link href={route(`/admin/cursos/${course.id}`)}>
                        Gerenciar curso
                      </Link>
                    </Button>
                  </div>
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
