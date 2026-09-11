"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { reprocessOutboxDeadLetterAction } from "@/features/outbox/actions";

export function OutboxDeadLetterReprocess({
  messageId,
}: {
  messageId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reprocess = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await reprocessOutboxDeadLetterAction(formData);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível reprocessar a mensagem."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form action={reprocess} className="grid min-w-52 gap-2">
      <input name="messageId" type="hidden" value={messageId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`outbox-reason-${messageId}`}>
            Motivo do reprocessamento
          </FieldLabel>
          <Input
            autoComplete="off"
            id={`outbox-reason-${messageId}`}
            maxLength={500}
            name="reason"
            required
          />
        </Field>
      </FieldGroup>
      <p className="text-muted-foreground text-xs">
        Após 24 horas, confirme o risco de duplicar um e-mail com resultado
        ambíguo.
      </p>
      {error ? (
        <p
          aria-live="assertive"
          className="text-destructive text-xs"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button loading={pending} size="sm" type="submit" variant="outline">
        Reprocessar uma vez
      </Button>
    </form>
  );
}
