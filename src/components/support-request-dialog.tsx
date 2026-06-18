"use client";

import { CustomerService01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { sendSupportRequestAction } from "@/app/(student)/app/actions";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SupportRequestDialogProps {
  courseTitle?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerMode?: "button" | "custom";
  triggerSize?: "default" | "sm";
  triggerVariant?: "default" | "ghost" | "outline" | "secondary";
}

const defaultSubject = "Preciso de ajuda com meu acesso";

export function SupportRequestDialog({
  courseTitle,
  triggerClassName,
  triggerLabel = "Falar com suporte",
  triggerMode = "button",
  triggerSize = "default",
  triggerVariant = "outline",
}: SupportRequestDialogProps): React.JSX.Element {
  const subject = courseTitle ? `Suporte sobre ${courseTitle}` : defaultSubject;

  return (
    <Dialog>
      {triggerMode === "custom" ? (
        <DialogTrigger
          className={cn(triggerClassName)}
          data-size={triggerSize}
          type="button"
        >
          <HugeiconsIcon
            icon={CustomerService01Icon}
            size={18}
            strokeWidth={1.5}
          />
          <span>{triggerLabel}</span>
        </DialogTrigger>
      ) : (
        <DialogTriggerButton
          className={triggerClassName}
          size={triggerSize}
          variant={triggerVariant}
        >
          <HugeiconsIcon
            icon={CustomerService01Icon}
            size={18}
            strokeWidth={2}
          />
          {triggerLabel}
        </DialogTriggerButton>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar pedido de suporte</DialogTitle>
          <DialogDescription>
            Descreva o problema para a equipe responder pelo e-mail da sua
            conta.
          </DialogDescription>
        </DialogHeader>
        <AutoCloseDialogForm action={sendSupportRequestAction}>
          <FieldGroup>
            {courseTitle ? (
              <input name="courseTitle" type="hidden" value={courseTitle} />
            ) : null}
            <Field>
              <FieldLabel>Assunto</FieldLabel>
              <Input defaultValue={subject} name="subject" required />
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
          </FieldGroup>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}
