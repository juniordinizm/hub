"use client";

import {
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  description: string | null;
  id: string;
  paymentProviderProductId: string | null;
  priceInCents: number;
  slug: string;
  status: string;
  subtitle: string | null;
  supportWhatsappUrl: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
}

interface CourseDialogProps {
  course: CourseData;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function CourseEditDialog({
  course,
  open,
  onOpenChange,
}: CourseDialogProps): React.JSX.Element {
  const dialogProps: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
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
        <DialogTriggerButton size="sm" variant="outline">
          <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
          Editar curso
        </DialogTriggerButton>
      )}
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

export function DeleteCourseDialog({
  course,
  open,
  onOpenChange,
}: CourseDialogProps): React.JSX.Element {
  const dialogProps: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
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
              disabled
              min={0}
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
          <FieldLabel>Preço do curso</FieldLabel>
          <Input
            defaultValue={formatCurrencyInCents(course.priceInCents)}
            disabled
          />
        </Field>
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
              disabled
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
