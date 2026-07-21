"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  approvePrivacyRequestAction,
  executePrivacyAnonymizationAction,
} from "@/features/privacy/actions";
import type { PrivacyRequestRecord } from "@/features/privacy/server";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";

export function PrivacyRequestOperations({
  anonymizationEnabled,
  canApprove,
  canExecute,
  request,
}: {
  anonymizationEnabled: boolean;
  canApprove: boolean;
  canExecute: boolean;
  request: PrivacyRequestRecord;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async (
    action: (formData: FormData) => Promise<void>
  ): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("requestId", request.id);
      await action(formData);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {request.status === "requested" && canApprove ? (
        <Button
          disabled={pending}
          onClick={() => run(approvePrivacyRequestAction)}
          size="sm"
          type="button"
          variant="outline"
        >
          {pending ? "Salvando..." : "Aprovar solicitação"}
        </Button>
      ) : null}
      {request.status === "approved" && canExecute ? (
        <Button
          disabled={pending || !anonymizationEnabled}
          onClick={() => run(executePrivacyAnonymizationAction)}
          size="sm"
          type="button"
          variant="destructive"
        >
          {pending ? "Executando..." : "Executar anonimização"}
        </Button>
      ) : null}
      {request.status === "approved" && !anonymizationEnabled ? (
        <p className="text-muted-foreground text-xs">
          Execução bloqueada por política jurídica.
        </p>
      ) : null}
      {error ? (
        <p
          aria-live="polite"
          className="w-full text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
