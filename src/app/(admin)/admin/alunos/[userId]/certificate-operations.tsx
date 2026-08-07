"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type CertificateActionState,
  certificateActionInitialState,
} from "@/features/certificates/action-state";
import {
  issueManualCertificateAction,
  reissueCertificateAction,
  revokeCertificateAction,
} from "@/features/certificates/actions";
import {
  CERTIFICATE_REASON_CODES,
  certificateReasonLabel,
} from "@/features/certificates/reasons";
import type { CertificateOperationRecord } from "@/features/certificates/server";

type CertificateAction = (
  previousState: CertificateActionState,
  formData: FormData
) => Promise<CertificateActionState>;

function CertificateForm({
  action,
  certificateId,
  courses,
  label,
  userId,
}: {
  action: CertificateAction;
  certificateId?: string;
  courses: Array<{ id: string; title: string }>;
  label: string;
  userId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    action,
    certificateActionInitialState
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);
  const submit = (formData: FormData): void => {
    if (formData.get("confirmed") !== "yes") {
      setLocalError("Confirme que revisou esta operação antes de continuar.");
      return;
    }
    setLocalError(null);
    formAction(formData);
  };
  return (
    <form action={submit} className="mt-3 grid gap-2 rounded border p-3">
      <input name="userId" type="hidden" value={userId} />
      {certificateId ? (
        <input name="certificateId" type="hidden" value={certificateId} />
      ) : (
        <label className="grid gap-1 text-sm">
          Curso
          <select
            className="rounded border bg-background p-2"
            name="courseId"
            required
          >
            <option value="">Selecione</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm">
        Categoria
        <select
          className="rounded border bg-background p-2"
          name="reasonCategory"
          required
        >
          <option value="">Selecione</option>
          {CERTIFICATE_REASON_CODES.map((reason) => (
            <option key={reason} value={reason}>
              {certificateReasonLabel(reason)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Detalhe interno
        <textarea
          className="min-h-20 rounded border bg-background p-2"
          name="reasonDetail"
          required
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="confirmed" required type="checkbox" value="yes" />
        Confirmo que revisei os dados e entendo que a operação será auditada.
      </label>
      <Button
        disabled={pending}
        type="submit"
        variant={label.includes("Revogar") ? "destructive" : "outline"}
      >
        {pending ? "Salvando..." : label}
      </Button>
      {localError || state.status === "error" ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {localError ?? state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CertificateOperations({
  certificates,
  courses,
  userId,
}: {
  certificates: CertificateOperationRecord[];
  courses: Array<{ id: string; title: string }>;
  userId: string;
}): React.JSX.Element {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="font-semibold text-lg">Certificados</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Downloads anteriores não podem ser recolhidos; a revogação fica visível
        no verificador público.
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer font-medium">
          Emitir certificado manual
        </summary>
        <CertificateForm
          action={issueManualCertificateAction}
          courses={courses}
          label="Emitir certificado"
          userId={userId}
        />
      </details>
      {certificates.map((certificate) => (
        <article className="mt-4 rounded border p-3" key={certificate.id}>
          <p className="font-medium">{certificate.courseTitle}</p>
          <p className="text-muted-foreground text-sm">
            {certificate.code} · {certificate.status}
          </p>
          {certificate.canReissue ? (
            <>
              {certificate.status === "valid" ? (
                <CertificateForm
                  action={revokeCertificateAction}
                  certificateId={certificate.id}
                  courses={courses}
                  label="Revogar certificado"
                  userId={userId}
                />
              ) : null}
              <CertificateForm
                action={reissueCertificateAction}
                certificateId={certificate.id}
                courses={courses}
                label="Reemitir certificado"
                userId={userId}
              />
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}
