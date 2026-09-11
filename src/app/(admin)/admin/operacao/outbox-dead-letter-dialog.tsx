"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/formatters";
import { OutboxDeadLetterReprocess } from "./outbox-dead-letters";

interface OutboxDeadLetterRecord {
  attempts: number;
  createdAt: Date;
  id: string;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  topic: string;
}

function DetailItem({
  children,
  label,
  mono = false,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono ? "type-code break-all" : "text-sm"}>{children}</dd>
    </div>
  );
}

export function OutboxDeadLetterDialog({
  canRetry,
  message,
}: {
  canRetry: boolean;
  message: OutboxDeadLetterRecord;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Abrir detalhes da mensagem ${message.topic}`}
          onClick={() => setOpen(true)}
          ref={triggerRef}
          size="sm"
          type="button"
          variant="ghost"
        >
          Detalhes
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-end"
            icon={ViewIcon}
            size={16}
            strokeWidth={2}
          />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl"
        onCloseAutoFocus={(focusEvent) => {
          focusEvent.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Mensagem em dead letter</DialogTitle>
          <DialogDescription>
            A mensagem esgotou as tentativas automáticas e precisa de uma
            decisão manual.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="overscroll-contain">
          <div className="flex flex-col gap-6">
            <section aria-labelledby={`outbox-summary-${message.id}`}>
              <div className="flex items-center gap-2">
                <h3
                  className="type-card-title"
                  id={`outbox-summary-${message.id}`}
                >
                  Resumo
                </h3>
                <Badge variant="destructive">Dead letter</Badge>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailItem label="Tópico" mono>
                  {message.topic}
                </DetailItem>
                <DetailItem label="Tentativas">
                  <span className="tabular-nums">{message.attempts}</span>
                </DetailItem>
                <DetailItem label="Última falha">
                  {message.lastErrorAt
                    ? formatDateTime(message.lastErrorAt)
                    : "Não informada"}
                </DetailItem>
                <DetailItem label="Código do erro" mono>
                  {message.lastErrorCode ?? "Não informado"}
                </DetailItem>
                <DetailItem label="Criada em">
                  {formatDateTime(message.createdAt)}
                </DetailItem>
                <DetailItem label="ID da mensagem" mono>
                  {message.id}
                </DetailItem>
              </dl>
            </section>

            <Separator />

            <section aria-labelledby={`outbox-action-${message.id}`}>
              <h3
                className="type-card-title"
                id={`outbox-action-${message.id}`}
              >
                Recuperação
              </h3>
              {canRetry ? (
                <>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Confirme o agregado relacionado. Após 24 horas, existe risco
                    de duplicar um e-mail.
                  </p>
                  <OutboxDeadLetterReprocess messageId={message.id} />
                </>
              ) : (
                <p className="mt-1 text-muted-foreground text-sm">
                  Somente Administrador pode reprocessar esta mensagem.
                </p>
              )}
            </section>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
