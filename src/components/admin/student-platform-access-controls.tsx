"use client";

import { SquareLock02Icon, UndoIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { AdminMutationForm } from "@/components/admin-mutation-form";
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
  student,
}: {
  onSuccess?: () => void | Promise<void>;
  student: StudentPlatformAccessStudent;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const isBlocked = Boolean(student.platformBlockedAt);
  const formId = `platform-access-${student.userId}`;
  const handleSuccess = async (): Promise<void> => {
    setIsEditing(false);
    await onSuccess?.();
  };

  return (
    <section className="flex flex-col gap-3" data-student-platform-access>
      <div>
        <h2 className="font-semibold text-base">Acesso na plataforma</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Controle o acesso geral desta aluna, independentemente dos Cursos.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {isBlocked ? "Acesso bloqueado" : "Acesso ativo"}
          </p>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {isBlocked
              ? (student.platformBlockedReason ?? "Bloqueio administrativo")
              : "A aluna pode acessar a plataforma e seus Cursos liberados."}
          </p>
        </div>
        <Button
          onClick={() => setIsEditing((current) => !current)}
          size="sm"
          type="button"
          variant={isBlocked ? "outline" : "destructive"}
        >
          <HugeiconsIcon
            data-icon="inline-start"
            icon={isBlocked ? UndoIcon : SquareLock02Icon}
            size={16}
            strokeWidth={2}
          />
          {isBlocked ? "Restaurar acesso" : "Bloquear acesso"}
        </Button>
      </div>
      {isEditing ? (
        <div className="border-t pt-4" data-platform-access-form>
          {isBlocked ? (
            <AdminMutationForm
              action={restoreStudentPlatformAccessAction}
              className="flex flex-col gap-4"
              onSuccess={handleSuccess}
            >
              <input name="userId" type="hidden" value={student.userId} />
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
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsEditing(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="outline">
                  Restaurar acesso
                </Button>
              </div>
            </AdminMutationForm>
          ) : (
            <AdminMutationForm
              action={blockStudentPlatformAccessAction}
              className="flex flex-col gap-4"
              id={formId}
              onSuccess={handleSuccess}
            >
              <input name="userId" type="hidden" value={student.userId} />
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
                    O bloqueio impede o login e afeta todos os Cursos.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setIsEditing(false)}
                  type="button"
                  variant="ghost"
                >
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
                      <AlertDialogTitle>
                        Confirmar bloqueio da plataforma
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        A aluna perderá o acesso geral à plataforma e não
                        conseguirá mais fazer login. Deseja confirmar?
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
          )}
        </div>
      ) : null}
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
