"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { RetryWebhookOperation } from "@/components/admin/retry-webhook-operation";
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
import { getWebhookStatusPresentation } from "@/features/admin/status-presentation";
import { formatDateTime } from "@/lib/formatters";

interface WebhookRecoveryEvent {
  attemptCount: number;
  createdAt: Date;
  errorMessage: string | null;
  eventKey: string;
  eventName: string;
  id: string;
  nextAttemptAt: Date | null;
  status: string;
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

export function WebhookRecoveryDialog({
  canRetry,
  event,
}: {
  canRetry: boolean;
  event: WebhookRecoveryEvent;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const status = getWebhookStatusPresentation(event.status);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Abrir detalhes do webhook ${event.eventName}`}
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
          <DialogTitle>{event.eventName}</DialogTitle>
          <DialogDescription>
            Estado local do webhook · recebido em{" "}
            {formatDateTime(event.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="overscroll-contain">
          <div className="flex flex-col gap-6">
            <section aria-labelledby={`webhook-summary-${event.id}`}>
              <div className="flex items-center gap-2">
                <h3
                  className="type-card-title"
                  id={`webhook-summary-${event.id}`}
                >
                  Resumo
                </h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailItem label="Evento" mono>
                  {event.eventName}
                </DetailItem>
                <DetailItem label="Tentativas">
                  <span className="tabular-nums">{event.attemptCount}</span>
                </DetailItem>
                <DetailItem label="Próxima tentativa">
                  {event.nextAttemptAt
                    ? formatDateTime(event.nextAttemptAt)
                    : "Não agendada"}
                </DetailItem>
                <DetailItem label="Recebido em">
                  {formatDateTime(event.createdAt)}
                </DetailItem>
                <DetailItem label="Chave do evento" mono>
                  {event.eventKey}
                </DetailItem>
                {event.errorMessage ? (
                  <DetailItem label="Erro registrado">
                    <span className="break-words">{event.errorMessage}</span>
                  </DetailItem>
                ) : null}
              </dl>
            </section>

            <Separator />

            <section aria-labelledby={`webhook-action-${event.id}`}>
              <h3 className="type-card-title" id={`webhook-action-${event.id}`}>
                Recuperação
              </h3>
              {canRetry ? (
                <>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Confira o Pedido no Asaas antes de reenfileirar o evento.
                  </p>
                  <RetryWebhookOperation webhookEventId={event.id} />
                </>
              ) : (
                <p className="mt-1 text-muted-foreground text-sm">
                  Somente Administrador pode reenfileirar este webhook.
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
