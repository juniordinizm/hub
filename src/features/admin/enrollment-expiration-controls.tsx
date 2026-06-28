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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

export const statusLabels: Record<string, string> = {
  active: "Ativo",
  expired: "Expirado",
  revoked: "Bloqueado",
};

export const formatDateTime = (value: Date | string): string =>
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
    <>
      {isBlocked && !isManuallyBlocked ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          Este acesso está bloqueado pelo status atual do pagamento na
          plataforma.
        </div>
      ) : null}

      {canChangeExpiration || canBlockAccess || isManuallyBlocked ? (
        <Accordion className="w-full" collapsible type="single">
          {canChangeExpiration ? (
            <AccordionItem className="border-none" value="adjust-expiration">
              <AccordionTrigger className="rounded-md px-4 py-3 text-sm hover:bg-muted/50 hover:no-underline data-[state=open]:bg-muted/30">
                Ajustar validade do acesso
              </AccordionTrigger>
              <AccordionContent className="border-t bg-muted/10 px-4 pt-4 pb-4">
                <AutoCloseDialogForm
                  action={adjustEnrollmentExpirationAction}
                  className="grid gap-5"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input
                    name="userId"
                    type="hidden"
                    value={enrollment.userId}
                  />
                  <input name="adjustment" type="hidden" value="set_exact" />

                  <dl className="grid gap-3 rounded-md border bg-background/60 p-3 text-sm sm:grid-cols-2">
                    <div className="grid gap-1">
                      <dt className="font-medium text-muted-foreground">
                        Expiracao original
                      </dt>
                      <dd>{formatDateTime(enrollment.originalExpiresAt)}</dd>
                    </div>
                    <div className="grid gap-1">
                      <dt className="font-medium text-muted-foreground">
                        Expiracao atual
                      </dt>
                      <dd>{formatDateTime(enrollment.expiresAt)}</dd>
                    </div>
                  </dl>

                  <div className="grid gap-1.5">
                    <span className="font-medium text-sm">
                      Nova data de expiração
                    </span>
                    <DatePickerField
                      defaultValue={formatDateInput(enrollment.expiresAt)}
                      minDate={today}
                      name="newExpiresAt"
                      placeholder="Selecionar data"
                    />
                  </div>

                  <label className="grid gap-1.5">
                    <span className="font-medium text-sm">
                      Motivo do ajuste
                    </span>
                    <input
                      className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      name="reason"
                      placeholder="Ex.: compensação por instabilidade no acesso"
                      required
                    />
                  </label>

                  <div className="flex justify-end pt-2">
                    <Button type="submit">
                      <HugeiconsIcon
                        icon={FloppyDiskIcon}
                        size={16}
                        strokeWidth={2}
                      />
                      Salvar ajuste
                    </Button>
                  </div>
                </AutoCloseDialogForm>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {canBlockAccess ? (
            <AccordionItem className="border-none" value="block-access">
              <AccordionTrigger className="rounded-md px-4 py-3 text-sm hover:bg-destructive/5 hover:text-destructive hover:no-underline data-[state=open]:bg-destructive/5 data-[state=open]:text-destructive">
                Bloquear acesso
              </AccordionTrigger>
              <AccordionContent className="border-destructive/10 border-t bg-destructive/5 px-4 pt-4 pb-4">
                <AutoCloseDialogForm
                  action={blockEnrollmentAccessAction}
                  className="grid gap-5"
                  id={`block-course-${enrollment.id}`}
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input
                    name="userId"
                    type="hidden"
                    value={enrollment.userId}
                  />
                  <label className="grid gap-1.5">
                    <span className="font-medium text-destructive text-sm">
                      Motivo do bloqueio
                    </span>
                    <input
                      className="rounded-md border-destructive/30 bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                      name="reason"
                      placeholder="Ex.: reembolso confirmado fora do webhook"
                      required
                    />
                  </label>
                  <div className="flex justify-end pt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive">
                          <HugeiconsIcon
                            icon={SquareLock02Icon}
                            size={16}
                            strokeWidth={2}
                          />
                          Bloquear acesso
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Confirmar bloqueio do curso
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            O aluno perderá o acesso imediato a este curso e
                            seus materiais. Deseja confirmar o bloqueio?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            form={`block-course-${enrollment.id}`}
                            type="submit"
                          >
                            Confirmar bloqueio
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </AutoCloseDialogForm>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {isManuallyBlocked ? (
            <AccordionItem className="border-none" value="restore-access">
              <AccordionTrigger className="rounded-md px-4 py-3 text-sm hover:bg-muted/50 hover:no-underline data-[state=open]:bg-muted/30">
                Restaurar acesso
              </AccordionTrigger>
              <AccordionContent className="border-t bg-muted/10 px-4 pt-4 pb-4">
                <AutoCloseDialogForm
                  action={restoreEnrollmentAccessAction}
                  className="grid gap-5"
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input
                    name="userId"
                    type="hidden"
                    value={enrollment.userId}
                  />
                  <label className="grid gap-1.5">
                    <span className="font-medium text-sm">
                      Motivo da restauração
                    </span>
                    <input
                      className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      name="reason"
                      placeholder="Ex.: bloqueio aplicado por engano"
                      required
                    />
                  </label>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" variant="outline">
                      <HugeiconsIcon
                        icon={UndoIcon}
                        size={16}
                        strokeWidth={2}
                      />
                      Restaurar acesso
                    </Button>
                  </div>
                </AutoCloseDialogForm>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      ) : null}
    </>
  );
}
