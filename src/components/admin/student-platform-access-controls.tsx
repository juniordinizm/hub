"use client";

import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FinanceHelp } from "@/components/admin/finance-help";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  blockStudentPlatformAccessAction,
  restoreStudentPlatformAccessAction,
} from "@/features/admin/actions";

export interface StudentPlatformAccessStudent {
  email: string;
  name: string;
  platformBlockedAt: string | null;
  platformBlockedReason: string | null;
  userId: string;
}

export function StudentPlatformAccessControls({
  onSuccess,
  readOnly = false,
  showHeading = true,
  student,
}: {
  onSuccess?: (() => void | Promise<void>) | undefined;
  readOnly?: boolean;
  showHeading?: boolean;
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  if (readOnly) {
    return <StudentPlatformAccessSummary student={student} />;
  }

  const isBlocked = Boolean(student.platformBlockedAt);

  return (
    <section className="flex flex-col gap-3" data-student-platform-access>
      {showHeading ? <StudentPlatformAccessHeading /> : null}
      <PlatformAccessStatusCard isBlocked={isBlocked} student={student} />
      {isBlocked ? (
        <Alert variant="destructive">
          <AlertTitle>Acesso bloqueado</AlertTitle>
          <AlertDescription>
            O bloqueio geral impede o login até que seja restaurado.
          </AlertDescription>
        </Alert>
      ) : null}
      {isBlocked ? (
        <RestorePlatformAccessForm onSuccess={onSuccess} student={student} />
      ) : (
        <BlockPlatformAccessForm onSuccess={onSuccess} student={student} />
      )}
    </section>
  );
}

function StudentPlatformAccessHeading(): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1">
        <h2 className="font-semibold text-base">Acesso na plataforma</h2>
        <FinanceHelp
          description="O bloqueio da plataforma é diferente do estado de uma Matrícula."
          details={[
            "Bloquear interrompe o login e o acesso geral a todos os Cursos.",
            "A operação é reversível, exige motivo e fica registrada na auditoria.",
          ]}
          title="Acesso na plataforma"
        />
      </div>
      <p className="mt-1 text-muted-foreground text-sm">
        Controle o acesso geral deste aluno, independentemente dos Cursos.
      </p>
    </div>
  );
}

function PlatformAccessStatusCard({
  isBlocked,
  student,
}: {
  isBlocked: boolean;
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-muted/10 p-4">
      <p className="font-medium text-sm">
        {isBlocked ? "Acesso bloqueado" : "Acesso ativo"}
      </p>
      <p className="mt-1 text-muted-foreground text-xs">
        {isBlocked
          ? (student.platformBlockedReason ?? "Bloqueio administrativo")
          : "O aluno pode acessar a plataforma e seus Cursos liberados."}
      </p>
    </div>
  );
}

function BlockPlatformAccessForm({
  onSuccess,
  student,
}: {
  onSuccess?: (() => void | Promise<void>) | undefined;
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  const studentId = student.userId ?? "";
  const formId = `platform-access-${studentId}`;

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className="rounded-lg border bg-muted/10 p-4"
    >
      <h3 className="font-semibold text-sm" id={`${formId}-title`}>
        Bloquear acesso da plataforma
      </h3>
      <p className="mt-1 text-muted-foreground text-xs">
        O aluno perderá o login e o acesso a todos os Cursos liberados.
      </p>
      <AdminMutationForm
        action={blockStudentPlatformAccessAction}
        className="mt-4 flex flex-col gap-4"
        id={formId}
        onSuccess={onSuccess}
      >
        <input name="userId" type="hidden" value={studentId} />
        <FieldGroup>
          <Field>
            <FieldLabel
              className="text-destructive"
              htmlFor={`${formId}-reason`}
            >
              Motivo do bloqueio
            </FieldLabel>
            <Input
              className="border-destructive/30"
              id={`${formId}-reason`}
              name="reason"
              placeholder="Ex.: revisão de segurança da conta"
              required
            />
            <FieldDescription>
              O motivo fica registrado na auditoria administrativa.
            </FieldDescription>
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
                <AlertDialogTitle>
                  Confirmar bloqueio da plataforma
                </AlertDialogTitle>
                <AlertDialogDescription>
                  O aluno perderá o acesso geral à plataforma e não conseguirá
                  mais fazer login. Deseja confirmar?
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
    </section>
  );
}

function RestorePlatformAccessForm({
  onSuccess,
  student,
}: {
  onSuccess?: (() => void | Promise<void>) | undefined;
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  const studentId = student.userId ?? "";
  const formId = `platform-access-${studentId}-restore`;

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className="rounded-lg border bg-muted/10 p-4"
    >
      <h3 className="font-semibold text-sm" id={`${formId}-title`}>
        Restaurar acesso da plataforma
      </h3>
      <p className="mt-1 text-muted-foreground text-xs">
        A restauração permite que o aluno volte a fazer login e use os Cursos
        liberados.
      </p>
      <AdminMutationForm
        action={restoreStudentPlatformAccessAction}
        className="mt-4 flex flex-col gap-4"
        onSuccess={onSuccess}
      >
        <input name="userId" type="hidden" value={studentId} />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${formId}-reason`}>
              Motivo da restauração
            </FieldLabel>
            <Input
              id={`${formId}-reason`}
              name="reason"
              placeholder="Ex.: conta revisada pelo suporte"
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
    </section>
  );
}

export function StudentPlatformAccessSummary({
  student,
}: {
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  const isBlocked = Boolean(student.platformBlockedAt);

  return (
    <section
      className="flex flex-col gap-3"
      data-student-platform-access-readonly
    >
      <StudentPlatformAccessHeading />
      <PlatformAccessStatusCard isBlocked={isBlocked} student={student} />
      {isBlocked ? (
        <Alert variant="destructive">
          <AlertTitle>Acesso bloqueado</AlertTitle>
          <AlertDescription>
            O bloqueio geral impede o login até que seja restaurado.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
