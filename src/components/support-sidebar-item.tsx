"use client";

import { CustomerService01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { sendSupportRequestAction } from "@/app/(student)/app/actions";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";

export function SupportSidebarItem(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setOpen(true)} tooltip="Suporte">
          <HugeiconsIcon
            icon={CustomerService01Icon}
            size={18}
            strokeWidth={1.5}
          />
          <span>Suporte</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar pedido de suporte</DialogTitle>
            <DialogDescription>
              Descreva o problema para a equipe responder pelo e-mail da sua
              conta.
            </DialogDescription>
          </DialogHeader>
          <AutoCloseDialogForm
            action={sendSupportRequestAction}
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody>
              <FieldGroup>
                <Field>
                  <FieldLabel>Assunto</FieldLabel>
                  <Input
                    name="subject"
                    placeholder="Preciso de ajuda com meu acesso"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Mensagem</FieldLabel>
                  <Textarea
                    name="message"
                    placeholder="Conte o que aconteceu e inclua detalhes como curso, aula ou pedido."
                    required
                    rows={6}
                  />
                </Field>
              </FieldGroup>
            </DialogBody>
            <DialogFooter>
              <Button type="submit">
                <HugeiconsIcon
                  icon={CustomerService01Icon}
                  size={18}
                  strokeWidth={2}
                />
                Enviar suporte
              </Button>
            </DialogFooter>
          </AutoCloseDialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
