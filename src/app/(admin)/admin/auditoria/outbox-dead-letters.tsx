"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
          : "Nao foi possivel reprocessar a mensagem."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form action={reprocess} className="grid gap-2">
      <input name="messageId" type="hidden" value={messageId} />
      <label
        className="grid gap-1 text-xs"
        htmlFor={`outbox-reason-${messageId}`}
      >
        Motivo do reprocessamento
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          id={`outbox-reason-${messageId}`}
          name="reason"
          required
        />
      </label>
      <p className="text-muted-foreground text-xs">
        Reprocessar depois de 24 horas pode duplicar um e-mail cujo resultado
        anterior ficou ambíguo.
      </p>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        {pending ? "Reprocessando..." : "Reprocessar uma vez"}
      </Button>
    </form>
  );
}
