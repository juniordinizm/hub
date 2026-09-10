"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { retryFailedAsaasWebhookAction } from "@/features/payments/actions";

export function RetryWebhookOperation({
  webhookEventId,
}: {
  webhookEventId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");

  const retry = async (): Promise<void> => {
    setError(null);
    setPending(true);

    try {
      const data = new FormData();
      data.set("webhookEventId", webhookEventId);
      data.set("reason", reason);
      await retryFailedAsaasWebhookAction(data);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível reprocessar o webhook."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2">
      <Field>
        <FieldLabel htmlFor={`retry-webhook-reason-${webhookEventId}`}>
          Motivo do reprocessamento
        </FieldLabel>
        <Input
          autoComplete="off"
          id={`retry-webhook-reason-${webhookEventId}`}
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </Field>
      <Button
        disabled={!reason.trim()}
        loading={pending}
        onClick={retry}
        size="sm"
        type="button"
        variant="outline"
      >
        Reprocessar webhook falho
      </Button>
      {error ? (
        <p
          aria-live="polite"
          className="mt-2 text-destructive text-sm"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
