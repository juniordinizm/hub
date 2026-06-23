"use client";
import {
  Cancel01Icon,
  Delete02Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTransition } from "react";
import { toast } from "sonner";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { deleteCourseAction, saveCourseAction } from "@/features/admin/actions";
import { formatCurrencyInCents } from "@/lib/formatters";

export interface CourseData {
  accessDurationMonths: number;
  coverImage?: unknown;
  description: string | null;
  id: string;
  paymentProviderProductId: string | null;
  priceInCents: number;
  slug: string;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
}

export function DeleteCourseDialog({
  course,
  onOpenChange,
  open,
}: {
  course: CourseData;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}): React.JSX.Element {
  const dialogProps: {
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  } = {};
  if (open !== undefined) {
    dialogProps.open = open;
  }
  if (onOpenChange !== undefined) {
    dialogProps.onOpenChange = onOpenChange;
  }

  return (
    <Dialog {...dialogProps}>
      {!onOpenChange && (
        <DialogTriggerButton size="sm" variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
          Excluir curso
        </DialogTriggerButton>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir curso?</DialogTitle>
          <DialogDescription>
            Esta ação remove o curso e, em cascata, seus módulos, aulas,
            matrículas, pedidos e certificados vinculados.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DeleteSummary
            detail="O identificador interno será preservado apenas no sistema."
            title={course.title}
          />
        </DialogBody>
        <AutoCloseDialogForm action={deleteCourseAction}>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                Cancelar
              </Button>
            </DialogClose>
            <input name="courseId" type="hidden" value={course.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function CourseSettingsForm({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const toastId = toast.loading("Salvando configurações...");

    startTransition(async () => {
      try {
        await saveCourseAction(formData);
        toast.success("Configurações salvas com sucesso!", { id: toastId });
      } catch {
        toast.error("Não foi possível salvar o curso.", { id: toastId });
      }
    });
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <fieldset className="contents" disabled={isPending}>
        <FieldGroup>
          <input name="courseId" type="hidden" value={course.id} />

          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-[auto_1fr]">
            <Field className="row-span-2 py-4">
              <CourseCoverUploadField
                courseId={course.id}
                defaultCoverImage={course.coverImage}
                defaultThumbnailUrl={course.thumbnailUrl}
              />
            </Field>
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input defaultValue={course.title} name="title" required />
            </Field>
            <Field>
              <FieldLabel>Subtítulo</FieldLabel>
              <Input defaultValue={course.subtitle ?? ""} name="subtitle" />
            </Field>
          </div>

          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              className="min-h-24 resize-y"
              defaultValue={course.description ?? ""}
              name="description"
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-3">
            <Field>
              <FieldLabel>Preço do curso</FieldLabel>
              <Input
                defaultValue={formatCurrencyInCents(course.priceInCents)}
                disabled
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
        </FieldGroup>

        <div className="mt-2 flex justify-end">
          <Button disabled={isPending} type="submit">
            <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
            {isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </fieldset>
    </form>
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
