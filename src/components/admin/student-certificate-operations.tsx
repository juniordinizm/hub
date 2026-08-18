"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDateTime } from "@/lib/formatters";
import type {
  StudentSheetCertificate,
  StudentSheetEnrollment,
} from "./student-management-types";

type CertificateAction = (
  previousState: CertificateActionState,
  formData: FormData
) => Promise<CertificateActionState>;

type ActiveCertificateOperation =
  | { kind: "issue" }
  | { certificate: StudentSheetCertificate; kind: "reissue" | "revoke" }
  | null;

function CertificateForm({
  action,
  certificateId,
  courses,
  label,
  onCancel,
  onSuccess,
  userId,
}: {
  action: CertificateAction;
  certificateId?: string;
  courses: StudentSheetEnrollment[];
  label: string;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
  userId: string;
}): React.JSX.Element {
  const [localError, setLocalError] = useState<string | null>(null);
  const [reasonCategory, setReasonCategory] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(
    courses.length === 1 ? (courses[0]?.courseId ?? "") : ""
  );
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    action,
    certificateActionInitialState
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      Promise.resolve(onSuccess()).catch(() => undefined);
    }
  }, [onSuccess, state.message, state.status]);

  const submit = (formData: FormData): void => {
    if (!(reasonCategory && (certificateId || selectedCourseId) && confirmed)) {
      setLocalError(
        "Revise os dados e confirme a operação antes de continuar."
      );
      return;
    }

    setLocalError(null);
    formData.set("reasonCategory", reasonCategory);
    formData.set("confirmed", "yes");
    if (!certificateId) {
      formData.set("courseId", selectedCourseId);
    }
    formAction(formData);
  };

  return (
    <form
      action={submit}
      className="flex flex-col gap-4 border-t pt-4"
      data-certificate-operation-form
    >
      <input name="userId" type="hidden" value={userId} />
      {certificateId ? (
        <input name="certificateId" type="hidden" value={certificateId} />
      ) : null}
      <FieldGroup>
        {certificateId ? null : (
          <Field>
            <FieldLabel htmlFor={`${label}-course-${userId}`}>Curso</FieldLabel>
            <Select
              onValueChange={setSelectedCourseId}
              value={selectedCourseId}
            >
              <SelectTrigger id={`${label}-course-${userId}`}>
                <SelectValue placeholder="Selecione o Curso" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.courseId} value={course.courseId}>
                    {course.courseTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${label}-reason-${userId}`}>
            Categoria do motivo
          </FieldLabel>
          <Select onValueChange={setReasonCategory} value={reasonCategory}>
            <SelectTrigger id={`${label}-reason-${userId}`}>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {CERTIFICATE_REASON_CODES.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {certificateReasonLabel(reason)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${label}-detail-${userId}`}>
            Detalhe interno
          </FieldLabel>
          <Textarea
            id={`${label}-detail-${userId}`}
            name="reasonDetail"
            placeholder="Descreva o motivo para a auditoria"
            required
          />
          <FieldDescription>
            Este detalhe fica restrito à operação e à auditoria.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Field orientation="horizontal">
        <Checkbox
          checked={confirmed}
          id={`${label}-confirmed-${userId}`}
          onCheckedChange={(value) => setConfirmed(value === true)}
        />
        <FieldLabel htmlFor={`${label}-confirmed-${userId}`}>
          Confirmo que revisei os dados e entendo que a operação será auditada.
        </FieldLabel>
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </Button>
        <Button
          disabled={pending}
          type="submit"
          variant={label.includes("Revogar") ? "destructive" : "default"}
        >
          {pending ? "Salvando…" : label}
        </Button>
      </div>
      {localError || state.status === "error" ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {localError ?? state.message}
        </p>
      ) : null}
    </form>
  );
}

const getRenderStatusLabel = (
  status: StudentSheetCertificate["renderStatus"]
): string => {
  if (status === "ready") {
    return "Pronto";
  }
  if (status === "pending") {
    return "Preparando";
  }
  return "Indisponível";
};

function CertificateHistoryItem({
  activeOperation,
  certificate,
  courses,
  onOperationSuccess,
  onSelectOperation,
  userId,
}: {
  activeOperation: ActiveCertificateOperation;
  certificate: StudentSheetCertificate;
  courses: StudentSheetEnrollment[];
  onOperationSuccess: () => void | Promise<void>;
  onSelectOperation: (kind: "reissue" | "revoke") => void;
  userId: string;
}): React.JSX.Element {
  const activeCertificate =
    activeOperation && activeOperation.kind !== "issue"
      ? activeOperation.certificate
      : null;
  const activeKind =
    activeOperation && activeOperation.kind !== "issue"
      ? activeOperation.kind
      : null;
  const isActive = activeCertificate?.id === certificate.id;
  const operationAction =
    activeKind === "revoke"
      ? revokeCertificateAction
      : reissueCertificateAction;
  const operationLabel =
    activeKind === "revoke" ? "Revogar certificado" : "Reemitir certificado";

  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">
            {certificate.courseTitle}
          </p>
          <p className="mt-1 font-mono text-muted-foreground text-xs">
            {certificate.code}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Emitido em {formatDateTime(certificate.issuedAt)} ·{" "}
            {getRenderStatusLabel(certificate.renderStatus)}
          </p>
        </div>
        <Badge
          variant={certificate.status === "valid" ? "secondary" : "destructive"}
        >
          {certificate.status === "valid" ? "Válido" : "Revogado"}
        </Badge>
      </div>
      {certificate.canReissue ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {certificate.status === "valid" ? (
            <Button
              onClick={() => onSelectOperation("revoke")}
              size="sm"
              type="button"
              variant={
                isActive && activeKind === "revoke" ? "destructive" : "outline"
              }
            >
              Revogar
            </Button>
          ) : null}
          <Button
            onClick={() => onSelectOperation("reissue")}
            size="sm"
            type="button"
            variant={
              isActive && activeKind === "reissue" ? "secondary" : "outline"
            }
          >
            Reemitir
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-muted-foreground text-xs">
          Registro histórico; somente o certificado mais recente pode ser
          reemitido.
        </p>
      )}
      {isActive && activeKind ? (
        <CertificateForm
          action={operationAction}
          certificateId={certificate.id}
          courses={courses}
          label={operationLabel}
          onCancel={() => onSelectOperation(activeKind)}
          onSuccess={onOperationSuccess}
          userId={userId}
        />
      ) : null}
    </div>
  );
}

export function StudentCertificateOperations({
  certificates,
  courses,
  onRefresh,
  userId,
}: {
  certificates: StudentSheetCertificate[];
  courses: StudentSheetEnrollment[];
  onRefresh: () => void | Promise<void>;
  userId: string;
}): React.JSX.Element {
  const [activeOperation, setActiveOperation] =
    useState<ActiveCertificateOperation>(null);
  const onOperationSuccess = async (): Promise<void> => {
    setActiveOperation(null);
    await onRefresh();
  };

  return (
    <section className="flex flex-col gap-4" data-student-certificates>
      <div>
        <h2 className="font-semibold text-base">Certificados</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Histórico e operações administrativas desta aluna.
        </p>
      </div>
      {courses.length ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="font-medium text-sm">Nova emissão</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Emita um certificado manual usando os dados históricos do Curso.
            </p>
          </div>
          <Button
            onClick={() =>
              setActiveOperation((current) =>
                current?.kind === "issue" ? null : { kind: "issue" }
              )
            }
            size="sm"
            type="button"
            variant={
              activeOperation?.kind === "issue" ? "secondary" : "outline"
            }
          >
            {activeOperation?.kind === "issue"
              ? "Fechar"
              : "Emitir certificado manual"}
          </Button>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          É necessário matricular a aluna em um Curso antes de emitir um
          certificado manual.
        </p>
      )}
      {activeOperation?.kind === "issue" ? (
        <CertificateForm
          action={issueManualCertificateAction}
          courses={courses}
          label="Emitir certificado"
          onCancel={() => setActiveOperation(null)}
          onSuccess={onOperationSuccess}
          userId={userId}
        />
      ) : null}
      {certificates.length ? (
        <div className="divide-y rounded-lg border" data-certificate-history>
          {certificates.map((certificate) => (
            <CertificateHistoryItem
              activeOperation={activeOperation}
              certificate={certificate}
              courses={courses}
              key={certificate.id}
              onOperationSuccess={onOperationSuccess}
              onSelectOperation={(kind) =>
                setActiveOperation((current) =>
                  current?.kind === kind &&
                  current.certificate.id === certificate.id
                    ? null
                    : { certificate, kind }
                )
              }
              userId={userId}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          Nenhum certificado registrado para este contexto.
        </p>
      )}
    </section>
  );
}
