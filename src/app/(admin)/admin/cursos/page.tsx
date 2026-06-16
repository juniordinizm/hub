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
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

type CourseData = Awaited<
  ReturnType<typeof getAdminManagementData>
>["courses"][number];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: {
    label: "Ativo",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  draft: {
    label: "Rascunho",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  archived: {
    label: "Arquivado",
    color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
};

const WHITESPACE_RE = /\s+/;
const THUMB_GRADIENTS = [
  "from-primary to-sidebar",
  "from-accent to-primary",
  "from-emerald-700 to-primary",
  "from-sky-700 to-primary",
  "from-rose-700 to-accent",
] as const;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

const getGradient = (id: string): string => {
  let sum = 0;
  for (const char of id) {
    sum += char.charCodeAt(0);
  }
  return THUMB_GRADIENTS[sum % THUMB_GRADIENTS.length] ?? THUMB_GRADIENTS[0];
};

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
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
            <DialogTrigger asChild>
              <Button>
                <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
                Novo curso
              </Button>
            </DialogTrigger>
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            color: "bg-zinc-500/15 text-zinc-600",
          };

          return (
            <Link
              className="group relative flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md hover:ring-1 hover:ring-foreground/10"
              href={route(`/admin/cursos/${course.id}`)}
              key={course.id}
            >
              <div
                className={`relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br ${getGradient(course.id)}`}
              >
                <span className="select-none font-bold text-4xl text-white/90 tracking-wider">
                  {getInitials(course.title)}
                </span>
                <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/5" />
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 font-semibold text-base leading-snug">
                    {course.title}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-[11px] ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {course.subtitle ? (
                  <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                    {course.subtitle}
                  </p>
                ) : null}

                <div className="mt-auto flex items-center gap-3 border-t pt-3 text-muted-foreground text-xs">
                  <span>{courseModules.length} módulos</span>
                  <span className="text-foreground/20">·</span>
                  <span>{lessonsCount} aulas</span>
                  <span className="text-foreground/20">·</span>
                  <span>{course.accessDurationMonths}m acesso</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
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
          <FieldLabel>Capa do curso</FieldLabel>
          <Input
            defaultValue={course?.thumbnailUrl ?? ""}
            name="thumbnailUrl"
            placeholder="/protear/dash-banner.png"
          />
        </Field>
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
