"use client";

import {
  FloppyDiskIcon,
  SquareLock02Icon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { AdminMutationForm } from "@/components/admin-mutation-form";
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
import { formatDateInput, formatDateTime } from "@/lib/formatters";

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

export const statusLabels: Record<string, string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Bloqueado",
};

type EnrollmentControl = "adjust" | "block" | "restore";

export function EnrollmentExpirationControls({
  enrollment,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onSuccess?: () => void | Promise<void>;
}): React.JSX.Element {
  const [activeControl, setActiveControl] = useState<EnrollmentControl | null>(
    null
  );
  const isBlocked = enrollment.status === "revoked";
  const isManuallyBlocked =
    isBlocked && enrollment.revokedReason === "manual_access_block";
  const canChangeExpiration = !isBlocked;
  const canBlockAccess =
    enrollment.status === "active" || enrollment.status === "expired";
  const closeAfterSuccess = async (): Promise<void> => {
    setActiveControl(null);
    await onSuccess?.();
  };

  return (
    <div className="flex flex-col gap-3" data-enrollment-controls>
      {isBlocked && !isManuallyBlocked ? <PaymentBlockNotice /> : null}
      <EnrollmentControlButtons
        activeControl={activeControl}
        canBlockAccess={canBlockAccess}
        canChangeExpiration={canChangeExpiration}
        isManuallyBlocked={isManuallyBlocked}
        onSelect={setActiveControl}
      />
      {activeControl === "adjust" ? (
        <EnrollmentAdjustmentForm
          enrollment={enrollment}
          onCancel={() => setActiveControl(null)}
          onSuccess={closeAfterSuccess}
        />
      ) : null}
      {activeControl === "block" ? (
        <EnrollmentBlockForm
          enrollment={enrollment}
          onCancel={() => setActiveControl(null)}
          onSuccess={closeAfterSuccess}
        />
      ) : null}
      {activeControl === "restore" ? (
        <EnrollmentRestoreForm
          enrollment={enrollment}
          onCancel={() => setActiveControl(null)}
          onSuccess={closeAfterSuccess}
        />
      ) : null}
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

function EnrollmentControlButtons({
  activeControl,
  canBlockAccess,
  canChangeExpiration,
  isManuallyBlocked,
  onSelect,
}: {
  activeControl: EnrollmentControl | null;
  canBlockAccess: boolean;
  canChangeExpiration: boolean;
  isManuallyBlocked: boolean;
  onSelect: (control: EnrollmentControl) => void;
}): React.JSX.Element | null {
  if (!(canChangeExpiration || canBlockAccess || isManuallyBlocked)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canChangeExpiration ? (
        <Button
          onClick={() => onSelect("adjust")}
          size="sm"
          type="button"
          variant={activeControl === "adjust" ? "secondary" : "outline"}
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={FloppyDiskIcon}
            size={16}
            strokeWidth={2}
          />
          Ajustar validade
        </Button>
      ) : null}
      {canBlockAccess ? (
        <Button
          onClick={() => onSelect("block")}
          size="sm"
          type="button"
          variant={activeControl === "block" ? "destructive" : "outline"}
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={SquareLock02Icon}
            size={16}
            strokeWidth={2}
          />
          Bloquear acesso
        </Button>
      ) : null}
      {isManuallyBlocked ? (
        <Button
          onClick={() => onSelect("restore")}
          size="sm"
          type="button"
          variant={activeControl === "restore" ? "secondary" : "outline"}
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={UndoIcon}
            size={16}
            strokeWidth={2}
          />
          Restaurar acesso
        </Button>
      ) : null}
    </div>
  );
}

function EnrollmentAdjustmentForm({
  enrollment,
  onCancel,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  return (
    <AdminMutationForm
      action={adjustEnrollmentExpirationAction}
      className="flex flex-col gap-4 border-t pt-4"
      onSuccess={onSuccess}
    >
      <input name="enrollmentId" type="hidden" value={enrollment.id} />
      <input name="userId" type="hidden" value={enrollment.userId} />
      <input name="adjustment" type="hidden" value="set_exact" />
      <dl className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs">Expiração original</dt>
          <dd className="mt-1 font-medium">
            {formatDateTime(enrollment.originalExpiresAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Expiração atual</dt>
          <dd className="mt-1 font-medium">
            {formatDateTime(enrollment.expiresAt)}
          </dd>
        </div>
      </dl>
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
      <ControlFormActions onCancel={onCancel} submitLabel="Salvar ajuste" />
    </AdminMutationForm>
  );
}

function EnrollmentBlockForm({
  enrollment,
  onCancel,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  const formId = `${controlId}-block-form`;
  return (
    <AdminMutationForm
      action={blockEnrollmentAccessAction}
      className="flex flex-col gap-4 border-t pt-4"
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
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive">
              Bloquear acesso
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <HugeiconsIcon icon={SquareLock02Icon} />
              </AlertDialogMedia>
              <AlertDialogTitle>Confirmar bloqueio do Curso</AlertDialogTitle>
              <AlertDialogDescription>
                A aluna perderá o acesso imediato a este Curso. Deseja
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
  onCancel,
  onSuccess,
}: {
  enrollment: EnrollmentExpirationControlData;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}): React.JSX.Element {
  const controlId = `enrollment-${enrollment.id}`;
  return (
    <AdminMutationForm
      action={restoreEnrollmentAccessAction}
      className="flex flex-col gap-4 border-t pt-4"
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
      <ControlFormActions
        onCancel={onCancel}
        submitLabel="Restaurar acesso"
        variant="outline"
      />
    </AdminMutationForm>
  );
}

function ControlFormActions({
  onCancel,
  submitLabel,
  variant = "default",
}: {
  onCancel: () => void;
  submitLabel: string;
  variant?: "default" | "outline";
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-2">
      <Button onClick={onCancel} type="button" variant="ghost">
        Cancelar
      </Button>
      <Button type="submit" variant={variant}>
        {submitLabel}
      </Button>
    </div>
  );
}
