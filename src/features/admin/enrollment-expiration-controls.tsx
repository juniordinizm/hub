"use client";

import {
  FloppyDiskIcon,
  SquareLock02Icon,
  UndoIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format } from "date-fns";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { DatePickerField } from "@/components/date-picker-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  adjustEnrollmentExpirationAction,
  blockEnrollmentAccessAction,
  restoreEnrollmentAccessAction,
} from "@/features/admin/actions";

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

const statusLabels: Record<string, string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Bloqueado",
};

const formatDateTime = (value: Date | string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const formatDateInput = (value: Date | string): string =>
  format(new Date(value), "yyyy-MM-dd");

export function EnrollmentExpirationControls({
  enrollment,
}: {
  enrollment: EnrollmentExpirationControlData;
}): React.JSX.Element {
  const today = new Date();
  const isBlocked = enrollment.status === "revoked";
  const isManuallyBlocked =
    isBlocked && enrollment.revokedReason === "manual_access_block";
  const canChangeExpiration = !isBlocked;
  const canBlockAccess =
    enrollment.status === "active" || enrollment.status === "expired";

  return (
    <section className="overflow-hidden rounded-md border bg-background">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold">{enrollment.courseTitle}</p>
          <dl className="mt-2 grid gap-1 text-muted-foreground text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Inicio</dt>
              <dd>{formatDateTime(enrollment.startedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">
                Expiracao original
              </dt>
              <dd>{formatDateTime(enrollment.originalExpiresAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Expiracao atual</dt>
              <dd>{formatDateTime(enrollment.expiresAt)}</dd>
            </div>
          </dl>
        </div>
        <Badge className="w-fit" variant="outline">
          {statusLabels[enrollment.status] ?? enrollment.status}
        </Badge>
      </header>

      {canChangeExpiration ? (
        <AutoCloseDialogForm
          action={adjustEnrollmentExpirationAction}
          className="grid gap-4 p-4"
        >
          <input name="enrollmentId" type="hidden" value={enrollment.id} />
          <input name="userId" type="hidden" value={enrollment.userId} />
          <input name="adjustment" type="hidden" value="set_exact" />

          <div className="grid gap-1.5">
            <span className="font-medium text-sm">Nova data de expiracao</span>
            <DatePickerField
              defaultValue={formatDateInput(enrollment.expiresAt)}
              minDate={today}
              name="newExpiresAt"
              placeholder="Selecionar data"
            />
          </div>

          <label className="grid gap-1.5">
            <span className="font-medium text-sm">Motivo do ajuste</span>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              name="reason"
              placeholder="Ex.: compensacao por instabilidade no acesso"
              required
            />
          </label>

          <div className="flex justify-end border-t pt-4">
            <Button type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={16} strokeWidth={2} />
              Salvar ajuste
            </Button>
          </div>
        </AutoCloseDialogForm>
      ) : null}

      {canBlockAccess ? (
        <AutoCloseDialogForm
          action={blockEnrollmentAccessAction}
          className="grid gap-4 border-t bg-muted/20 p-4"
        >
          <input name="enrollmentId" type="hidden" value={enrollment.id} />
          <input name="userId" type="hidden" value={enrollment.userId} />
          <label className="grid gap-1.5">
            <span className="font-medium text-sm">Motivo do bloqueio</span>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              name="reason"
              placeholder="Ex.: reembolso confirmado fora do webhook"
              required
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="destructive">
              <HugeiconsIcon
                icon={SquareLock02Icon}
                size={16}
                strokeWidth={2}
              />
              Bloquear acesso
            </Button>
          </div>
        </AutoCloseDialogForm>
      ) : null}

      {isManuallyBlocked ? (
        <AutoCloseDialogForm
          action={restoreEnrollmentAccessAction}
          className="grid gap-4 border-t bg-muted/20 p-4"
        >
          <input name="enrollmentId" type="hidden" value={enrollment.id} />
          <input name="userId" type="hidden" value={enrollment.userId} />
          <label className="grid gap-1.5">
            <span className="font-medium text-sm">Motivo da restauracao</span>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              name="reason"
              placeholder="Ex.: bloqueio aplicado por engano"
              required
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="outline">
              <HugeiconsIcon icon={UndoIcon} size={16} strokeWidth={2} />
              Restaurar acesso
            </Button>
          </div>
        </AutoCloseDialogForm>
      ) : null}

      {isBlocked && !isManuallyBlocked ? (
        <div className="border-t bg-muted/20 p-4 text-muted-foreground text-sm">
          Este acesso foi bloqueado pelo status do pagamento.
        </div>
      ) : null}
    </section>
  );
}
