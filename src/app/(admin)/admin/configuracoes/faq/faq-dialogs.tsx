"use client";

import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AdminMutationSubmitButton } from "@/components/admin-mutation-form";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
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

export function FaqCreateDialog({
  nextSortOrder,
}: {
  nextSortOrder: number;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton>
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={Add01Icon}
          size={16}
          strokeWidth={2}
        />
        Nova pergunta
      </DialogTriggerButton>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
          <DialogDescription>
            Cadastre uma resposta curta e objetiva.
          </DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm
          action={saveFaqAction}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody>
            <FieldGroup>
              <input name="faqId" type="hidden" />
              <Field>
                <FieldLabel htmlFor="faq-question-create">Pergunta</FieldLabel>
                <Input id="faq-question-create" name="question" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="faq-answer-create">Resposta</FieldLabel>
                <Textarea id="faq-answer-create" name="answer" required />
              </Field>
              <input name="sortOrder" type="hidden" value={nextSortOrder} />
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
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <AdminMutationSubmitButton type="submit">
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={FloppyDiskIcon}
                size={18}
                strokeWidth={2}
              />
              Salvar FAQ
            </AdminMutationSubmitButton>
          </DialogFooter>
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
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={Edit01Icon}
            size={16}
            strokeWidth={2}
          />
          Editar FAQ
        </DialogTriggerButton>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar FAQ</DialogTitle>
          <DialogDescription>Atualize os detalhes do FAQ.</DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm
          action={saveFaqAction}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody>
            <FieldGroup>
              <input name="faqId" type="hidden" value={faq.id} />
              <Field>
                <FieldLabel htmlFor={`faq-question-${faq.id}`}>
                  Pergunta
                </FieldLabel>
                <Input
                  defaultValue={faq.question}
                  id={`faq-question-${faq.id}`}
                  name="question"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`faq-answer-${faq.id}`}>
                  Resposta
                </FieldLabel>
                <Textarea
                  defaultValue={faq.answer}
                  id={`faq-answer-${faq.id}`}
                  name="answer"
                  required
                />
              </Field>
              <input
                defaultValue={faq.sortOrder}
                name="sortOrder"
                type="hidden"
              />
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
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <AdminMutationSubmitButton type="submit">
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={FloppyDiskIcon}
                size={18}
                strokeWidth={2}
              />
              Salvar pergunta
            </AdminMutationSubmitButton>
          </DialogFooter>
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
    <AlertDialog {...dialogProps}>
      {!onOpenChange && (
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive">
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Delete02Icon}
              size={16}
              strokeWidth={2}
            />
            Excluir FAQ
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} />
          </AlertDialogMedia>
          <AlertDialogTitle>Excluir FAQ?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação removerá a pergunta permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="font-semibold">{faq.question}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Cancel01Icon}
              size={16}
              strokeWidth={2}
            />
            Cancelar
          </AlertDialogCancel>
          <form action={deleteFaqAction} id={`delete-faq-${faq.id}`}>
            <input name="faqId" type="hidden" value={faq.id} />
          </form>
          <AlertDialogAction
            form={`delete-faq-${faq.id}`}
            type="submit"
            variant="destructive"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Delete02Icon}
              size={16}
              strokeWidth={2}
            />
            Confirmar exclusão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
