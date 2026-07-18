"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveBannerAction } from "@/features/admin/actions";
import type { AdminBanner } from "@/features/admin/server";

interface BannerEditModalProps {
  banner: AdminBanner;
  onClose: () => void;
  open: boolean;
}

export function BannerEditModal({
  banner,
  open,
  onClose,
}: BannerEditModalProps) {
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? "");

  const handleSubmit = async (formData: FormData) => {
    try {
      await saveBannerAction(formData);
      toast.success("Banner atualizado com sucesso!");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao atualizar o banner.";
      toast.error(errorMessage);
      throw error; // keep modal open if error
    }
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Banner</DialogTitle>
        </DialogHeader>

        <AutoCloseDialogForm action={handleSubmit}>
          <input name="bannerId" type="hidden" value={banner.id} />

          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>Link de destino (Opcional)</FieldLabel>
                <Input
                  name="linkUrl"
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://"
                  type="url"
                  value={linkUrl}
                />
              </Field>
              <Field>
                <FieldLabel>
                  Texto do botão {linkUrl ? "" : "(Requer Link)"}
                </FieldLabel>
                <Input
                  defaultValue={banner.buttonText ?? ""}
                  disabled={!linkUrl}
                  maxLength={30}
                  name="buttonText"
                  placeholder="Ex: Acessar"
                  required={!!linkUrl}
                />
              </Field>
              <label
                className="inline-flex cursor-pointer items-center gap-2 text-sm"
                htmlFor={`banner-is-active-edit-${banner.id}`}
              >
                <Checkbox
                  defaultChecked={banner.isActive}
                  id={`banner-is-active-edit-${banner.id}`}
                  name="isActive"
                />
                Ativo
              </label>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              Salvar alterações
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}
