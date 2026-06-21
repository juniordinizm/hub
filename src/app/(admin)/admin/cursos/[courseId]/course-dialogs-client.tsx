"use client";

import {
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
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
  return (
    <DiscardAwareDialog
      description="Atualize os dados principais do curso."
      onOpenChange={onOpenChange}
      open={open}
      title="Editar curso"
      trigger={
        onOpenChange ? undefined : (
          <DialogTriggerButton size="sm" variant="outline">
            <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
            Editar curso
          </DialogTriggerButton>
        )
      }
    >
      <CourseForm course={course} />
    </DiscardAwareDialog>
  );
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

function CourseForm({ course }: { course: CourseData }): React.JSX.Element {
  return (
    <AutoCloseDialogForm
      action={saveCourseAction}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
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
          <div className="grid gap-4 lg:grid-cols-2">
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
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <Button className="w-fit" type="submit">
          <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
          Salvar curso
        </Button>
      </DialogFooter>
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
