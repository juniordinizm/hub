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
import { deleteBannerAction, saveBannerAction } from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";

interface BannerDialogProps {
  banner: AdminBanner;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export function BannerCreateDialog(): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton>
        <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
        Novo banner
      </DialogTriggerButton>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo banner</DialogTitle>
          <DialogDescription>
            Adicione um banner para o dashboard do aluno (21:9 recomendado, máx
            5MB).
          </DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm
          action={saveBannerAction}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>Imagem (Obrigatório)</FieldLabel>
                <Input accept="image/*" name="imageFile" required type="file" />
              </Field>

              <Field>
                <FieldLabel>Link de destino (Opcional)</FieldLabel>
                <Input name="linkUrl" placeholder="https://" type="url" />
              </Field>
              <Field>
                <FieldLabel>Texto do botão (Opcional)</FieldLabel>
                <Input name="buttonText" placeholder="Ex: Acessar" />
              </Field>
              <label
                className="inline-flex items-center gap-2 text-sm"
                htmlFor="banner-is-active-create"
              >
                <Checkbox
                  defaultChecked
                  id="banner-is-active-create"
                  name="isActive"
                />
                Ativo
              </label>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              Salvar banner
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function BannerEditDialog({
  banner,
  open,
  onOpenChange,
}: BannerDialogProps): React.JSX.Element {
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
          Editar banner
        </DialogTriggerButton>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar banner</DialogTitle>
          <DialogDescription>
            Atualize as informações do banner.
          </DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm
          action={saveBannerAction}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody>
            <FieldGroup>
              <input name="bannerId" type="hidden" value={banner.id} />
              <Field>
                <FieldLabel>Nova Imagem (Opcional)</FieldLabel>
                <Input accept="image/*" name="imageFile" type="file" />
                <p className="mt-1 text-muted-foreground text-xs">
                  Deixe em branco para manter a atual.
                </p>
              </Field>

              <Field>
                <FieldLabel>Link de destino (Opcional)</FieldLabel>
                <Input
                  defaultValue={banner.linkUrl || ""}
                  name="linkUrl"
                  placeholder="https://"
                  type="url"
                />
              </Field>
              <Field>
                <FieldLabel>Texto do botão (Opcional)</FieldLabel>
                <Input
                  defaultValue={banner.buttonText || ""}
                  name="buttonText"
                  placeholder="Ex: Acessar"
                />
              </Field>
              <label
                className="inline-flex items-center gap-2 text-sm"
                htmlFor={`banner-is-active-${banner.id}`}
              >
                <Checkbox
                  defaultChecked={banner.isActive ?? false}
                  id={`banner-is-active-${banner.id}`}
                  name="isActive"
                />
                Ativo
              </label>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              Salvar banner
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function BannerDeleteDialog({
  banner,
  open,
  onOpenChange,
}: BannerDialogProps): React.JSX.Element {
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
          Excluir banner
        </DialogTriggerButton>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir banner?</DialogTitle>
          <DialogDescription>
            Esta ação removerá o banner permanentemente.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-lg border bg-background/40 p-3">
            <p className="font-semibold">Banner Selecionado</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteBannerAction}>
            <input name="bannerId" type="hidden" value={banner.id} />
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
