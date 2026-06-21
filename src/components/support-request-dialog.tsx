"use client";

import { CustomerService01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
  DialogTrigger,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SupportRequestDialogProps {
  children?: React.ReactNode;
  courseTitle?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerMode?: "button" | "custom" | "asChild";
  triggerSize?: "default" | "sm";
  triggerVariant?: "default" | "ghost" | "outline" | "secondary";
}

const defaultSubject = "Preciso de ajuda com meu acesso";

export function SupportRequestDialog({
  children,
  courseTitle,
  triggerClassName,
  triggerLabel = "Falar com suporte",
  triggerMode = "button",
  triggerSize = "default",
  triggerVariant = "outline",
}: SupportRequestDialogProps): React.JSX.Element {
  const subject = courseTitle ? `Suporte sobre ${courseTitle}` : defaultSubject;

  let triggerElement: React.ReactNode = null;
  if (triggerMode === "asChild") {
    triggerElement = <DialogTrigger asChild>{children}</DialogTrigger>;
  } else if (triggerMode === "custom") {
    triggerElement = (
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
    );
  } else {
    triggerElement = (
      <DialogTriggerButton
        className={triggerClassName}
        size={triggerSize}
        variant={triggerVariant}
      >
        <HugeiconsIcon icon={CustomerService01Icon} size={18} strokeWidth={2} />
        {triggerLabel}
      </DialogTriggerButton>
    );
  }

  return (
    <Dialog>
      {triggerElement}
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
  );
}
