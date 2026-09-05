"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { grantEnrollmentFullContentAccessAction } from "@/features/admin/actions";
import { formatDateTime } from "@/lib/formatters";
import type { StudentSheetEnrollment } from "./student-management-types";

export function StudentContentReleaseControls({
  enrollment,
  onSuccess,
}: {
  enrollment: StudentSheetEnrollment;
  onSuccess: () => void | Promise<void>;
}): React.JSX.Element | null {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (enrollment.contentReleaseMode !== "scheduled") {
    return null;
  }

  const submit = (): void => {
    const formData = new FormData();
    formData.set("enrollmentId", enrollment.id);
    formData.set("reason", reason);
    startTransition(() => {
      setError(null);
      grantEnrollmentFullContentAccessAction(formData)
        .then(async () => {
          setReason("");
          await onSuccess();
        })
        .catch(() => setError("Não foi possível liberar o conteúdo."));
    });
  };

  return (
    <details className="mt-4 rounded-lg border bg-muted/20 p-3">
      <summary className="cursor-pointer font-medium text-sm">
        Liberar conteúdo integral
      </summary>
      <div className="mt-3">
        <p className="font-medium text-sm">Liberação de conteúdo</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Liberação programada
          {enrollment.contentReleaseStartedAt
            ? ` desde ${formatDateTime(enrollment.contentReleaseStartedAt)}`
            : ""}
          . Esta ação é irreversível neste episódio.
        </p>
        {enrollment.nextModuleReleaseAt ? (
          <p className="mt-1 text-muted-foreground text-xs">
            Próximo Módulo em {formatDateTime(enrollment.nextModuleReleaseAt)}
          </p>
        ) : null}
        <label
          className="mt-3 block font-medium text-xs"
          htmlFor={`release-reason-${enrollment.id}`}
        >
          Motivo
        </label>
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border bg-background p-2 text-sm"
          id={`release-reason-${enrollment.id}`}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
        <Button
          className="mt-3"
          disabled={isPending || !reason.trim()}
          onClick={submit}
          size="sm"
          type="button"
        >
          {isPending ? "Liberando…" : "Liberar conteúdo integral"}
        </Button>
        {error ? (
          <p className="mt-2 text-destructive text-xs">{error}</p>
        ) : null}
      </div>
    </details>
  );
}
