"use client";

import {
  FloppyDiskIcon,
  SquareLock02Icon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { DatePickerField } from "@/components/date-picker-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  adjustEnrollmentExpirationAction,
  blockEnrollmentAccessAction,
  restoreEnrollmentAccessAction,
} from "@/features/admin/actions";
import { formatDateInput } from "@/lib/formatters";

export interface EnrollmentExpirationControlData {
  courseTitle: string;
  expiresAt: Date | string;
  id: string;
  originalExpiresAt: Date | string;
  revokedReason: string | null;
  startedAt: Date | string;
  status: string;
  userId: string;
}

export function EnrollmentExpirationControls({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  const isBlocked = enrollment.status === "revoked";
  const isManuallyBlocked =
    isBlocked && enrollment.revokedReason === "manual_access_block";
  const canChangeExpiration = !isBlocked;
  const canBlockAccess =
    enrollment.status === "active" || enrollment.status === "expired";

  return (
    <div className="flex flex-col gap-3" data-enrollment-controls>
      {isBlocked && !isManuallyBlocked ? <PaymentBlockNotice /> : null}
      {canChangeExpiration ? (
        <EnrollmentAdjustmentSection
          enrollment={enrollment}
          onSuccess={onSuccess}
        />
      ) : null}
      {canBlockAccess ? (
        <EnrollmentBlockSection enrollment={enrollment} onSuccess={onSuccess} />
      ) : null}
      {isManuallyBlocked ? (
        <EnrollmentRestoreSection
          enrollment={enrollment}
          onSuccess={onSuccess}
        />
      ) : null}
      {isManuallyBlocked ||
      canBlockAccess ||
      canChangeExpiration ||
      (isBlocked && !isManuallyBlocked) ? null : (
        <p className="text-muted-foreground text-sm">
          Não há ações disponíveis para esta Matrícula no estado atual.
        </p>
      )}
    </div>
  );
}

function PaymentBlockNotice(): React.JSX.Element {
  return (
    <Alert variant="destructive">
      <AlertTitle>Acesso bloqueado pelo pagamento</AlertTitle>
      <AlertDescription>
        Este acesso não pode ser restaurado manualmente enquanto o estado
        financeiro permanecer adverso.
      </AlertDescription>
    </Alert>
  );
}

function EnrollmentAdjustmentSection({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby={`enrollment-adjust-${enrollment.id}`}
      className="rounded-lg border bg-muted/10 p-4"
    >
      <div>
        <h4
          className="flex items-center gap-2 font-semibold text-sm"
          id={`enrollment-adjust-${enrollment.id}`}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={FloppyDiskIcon}
            size={16}
            strokeWidth={2}
          />
          Ajustar validade
        </h4>
        <p className="mt-1 text-muted-foreground text-xs">
          Defina a nova data em que o acesso a este Curso deve terminar.
        </p>
      </div>
      <EnrollmentAdjustmentForm enrollment={enrollment} onSuccess={onSuccess} />
    </section>
  );
}

function EnrollmentBlockSection({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby={`enrollment-block-${enrollment.id}`}
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
    >
      <div>
        <h4
          className="flex items-center gap-2 font-semibold text-sm"
          id={`enrollment-block-${enrollment.id}`}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={SquareLock02Icon}
            size={16}
            strokeWidth={2}
          />
          Bloquear acesso ao Curso
        </h4>
        <p className="mt-1 text-muted-foreground text-xs">
          Revogue a Matrícula manualmente para interromper o acesso a este
          Curso.
        </p>
      </div>
      <EnrollmentBlockForm enrollment={enrollment} onSuccess={onSuccess} />
    </section>
  );
}

function EnrollmentRestoreSection({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby={`enrollment-restore-${enrollment.id}`}
      className="rounded-lg border bg-muted/10 p-4"
    >
      <div>
        <h4
          className="flex items-center gap-2 font-semibold text-sm"
          id={`enrollment-restore-${enrollment.id}`}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={UndoIcon}
            size={16}
            strokeWidth={2}
          />
          Restaurar acesso ao Curso
        </h4>
        <p className="mt-1 text-muted-foreground text-xs">
          Reative a Matrícula bloqueada manualmente após revisar o caso.
        </p>
      </div>
      <EnrollmentRestoreForm enrollment={enrollment} onSuccess={onSuccess} />
    </section>
  );
}

function EnrollmentAdjustmentForm({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  return (
    <AdminMutationForm
      action={adjustEnrollmentExpirationAction}
      className="mt-4 flex flex-col gap-4"
      onSuccess={onSuccess}
    >
      <input name="enrollmentId" type="hidden" value={enrollment.id} />
      <input name="userId" type="hidden" value={enrollment.userId} />
      <input name="adjustment" type="hidden" value="set_exact" />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${controlId}-expires`}>
            Nova data de expiração
          </FieldLabel>
          <DatePickerField
            defaultValue={formatDateInput(enrollment.expiresAt)}
            id={`${controlId}-expires`}
            minDate={formatDateInput(new Date())}
            name="newExpiresAt"
            placeholder="Selecionar data"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${controlId}-reason`}>
            Motivo do ajuste
          </FieldLabel>
          <Input
            id={`${controlId}-reason`}
            name="reason"
            placeholder="Ex.: compensação por instabilidade no acesso"
            required
          />
        </Field>
      </FieldGroup>
      <div className="flex justify-end">
        <AdminMutationSubmitButton type="submit">
          Salvar ajuste
        </AdminMutationSubmitButton>
      </div>
    </AdminMutationForm>
  );
}

function EnrollmentBlockForm({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  const formId = `${controlId}-block-form`;
  return (
    <AdminMutationForm
      action={blockEnrollmentAccessAction}
      className="mt-4 flex flex-col gap-4"
      id={formId}
      onSuccess={onSuccess}
    >
      <input name="enrollmentId" type="hidden" value={enrollment.id} />
      <input name="userId" type="hidden" value={enrollment.userId} />
      <FieldGroup>
        <Field>
          <FieldLabel
            className="text-destructive"
            htmlFor={`${controlId}-block-reason`}
          >
            Motivo do bloqueio
          </FieldLabel>
          <Input
            className="border-destructive/30"
            id={`${controlId}-block-reason`}
            name="reason"
            placeholder="Ex.: reembolso confirmado fora do webhook"
            required
          />
        </Field>
      </FieldGroup>
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              Bloquear acesso
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <HugeiconsIcon aria-hidden="true" icon={SquareLock02Icon} />
              </AlertDialogMedia>
              <AlertDialogTitle>Confirmar bloqueio do Curso</AlertDialogTitle>
              <AlertDialogDescription>
                O aluno perderá o acesso imediato a este Curso. Deseja
                confirmar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                form={formId}
                type="submit"
              >
                Confirmar bloqueio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminMutationForm>
  );
}

function EnrollmentRestoreForm({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: (() => void | Promise<void>) | undefined;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  return (
    <AdminMutationForm
      action={restoreEnrollmentAccessAction}
      className="mt-4 flex flex-col gap-4"
      onSuccess={onSuccess}
    >
      <input name="enrollmentId" type="hidden" value={enrollment.id} />
      <input name="userId" type="hidden" value={enrollment.userId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${controlId}-restore-reason`}>
            Motivo da restauração
          </FieldLabel>
          <Input
            id={`${controlId}-restore-reason`}
            name="reason"
            placeholder="Ex.: bloqueio aplicado por engano"
            required
          />
        </Field>
      </FieldGroup>
      <div className="flex justify-end">
        <AdminMutationSubmitButton type="submit" variant="outline">
          Restaurar acesso
        </AdminMutationSubmitButton>
      </div>
    </AdminMutationForm>
  );
}
