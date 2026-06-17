"use client";

import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
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
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteFaqAction, saveFaqAction } from "@/features/admin/actions";

export interface FaqData {
  answer: string;
  category: string;
  id: string;
  isPublished: boolean;
  question: string;
  sortOrder: number;
}

interface FaqDialogProps {
  faq: FaqData;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function FaqCreateDialog(): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton>
        <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
        Nova pergunta
      </DialogTriggerButton>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
          <DialogDescription>
            Cadastre uma resposta curta e objetiva.
          </DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm action={saveFaqAction}>
          <FieldGroup>
            <input name="faqId" type="hidden" />
            <Field>
              <FieldLabel>Pergunta</FieldLabel>
              <Input name="question" required />
            </Field>
            <Field>
              <FieldLabel>Resposta</FieldLabel>
              <Textarea name="answer" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoria</FieldLabel>
                <Input name="category" />
              </Field>
              <Field>
                <FieldLabel>Ordem</FieldLabel>
                <Input name="sortOrder" type="number" />
              </Field>
            </div>
            <label
              className="inline-flex items-center gap-2 text-sm"
              htmlFor="faq-is-published-create"
            >
              <Checkbox
                defaultChecked
                id="faq-is-published-create"
                name="isPublished"
              />
              Publicado
            </label>
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              Salvar FAQ
            </Button>
          </FieldGroup>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function FaqEditDialog({
  faq,
  open,
  onOpenChange,
}: FaqDialogProps): React.JSX.Element {
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
          Editar FAQ
        </DialogTriggerButton>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar FAQ</DialogTitle>
          <DialogDescription>Atualize os detalhes do FAQ.</DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm action={saveFaqAction}>
          <FieldGroup>
            <input name="faqId" type="hidden" value={faq.id} />
            <Field>
              <FieldLabel>Pergunta</FieldLabel>
              <Input defaultValue={faq.question} name="question" required />
            </Field>
            <Field>
              <FieldLabel>Resposta</FieldLabel>
              <Textarea defaultValue={faq.answer} name="answer" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Categoria</FieldLabel>
                <Input defaultValue={faq.category} name="category" />
              </Field>
              <Field>
                <FieldLabel>Ordem</FieldLabel>
                <Input
                  defaultValue={faq.sortOrder}
                  name="sortOrder"
                  type="number"
                />
              </Field>
            </div>
            <label
              className="inline-flex items-center gap-2 text-sm"
              htmlFor={`faq-is-published-${faq.id}`}
            >
              <Checkbox
                defaultChecked={faq.isPublished ?? false}
                id={`faq-is-published-${faq.id}`}
                name="isPublished"
              />
              Publicado
            </label>
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              Salvar pergunta
            </Button>
          </FieldGroup>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function FaqDeleteDialog({
  faq,
  open,
  onOpenChange,
}: FaqDialogProps): React.JSX.Element {
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
          Excluir FAQ
        </DialogTriggerButton>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir FAQ?</DialogTitle>
          <DialogDescription>
            Esta ação removerá a pergunta permanentemente.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="font-semibold">{faq.question}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteFaqAction}>
            <input name="faqId" type="hidden" value={faq.id} />
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
