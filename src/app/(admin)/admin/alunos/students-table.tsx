"use client";

import {
  SquareLock02Icon,
  UndoIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
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
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  blockStudentPlatformAccessAction,
  restoreStudentPlatformAccessAction,
} from "@/features/admin/actions";
import { formatShortDate } from "@/lib/formatters";

export interface StudentEnrollmentRow {
  courseTitle: string;
  expiresAt: string;
  id: string;
  originalExpiresAt: string;
  revokedReason: string | null;
  startedAt: string;
  status: string;
  userId: string;
}

export interface StudentTableRow {
  courseCount: number;
  email: string;
  enrollments: StudentEnrollmentRow[];
  firstEnrollmentAt: string | null;
  lastAccessAt: string | null;
  latestExpiration: string | null;
  name: string;
  platformBlockedAt: string | null;
  platformBlockedReason: string | null;
  userId: string;
}

const formatNullableDate = (value: string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return formatShortDate(value);
};

const columns: ColumnDef<StudentTableRow>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "courseCount",
    header: "Cursos",
    cell: ({ row }) => row.original.courseCount,
  },
  {
    accessorKey: "platformBlockedAt",
    header: "Plataforma",
    cell: ({ row }) =>
      row.original.platformBlockedAt ? (
        <Badge variant="destructive">Bloqueado</Badge>
      ) : (
        <Badge variant="outline">Ativo</Badge>
      ),
  },
  {
    accessorKey: "latestExpiration",
    header: "Expiracao final",
    cell: ({ row }) => formatNullableDate(row.original.latestExpiration),
  },
  {
    accessorKey: "lastAccessAt",
    header: "Ultimo acesso",
    cell: ({ row }) => formatNullableDate(row.original.lastAccessAt),
  },
  {
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => <StudentEnrollmentsDialog student={row.original} />,
  },
];

export function StudentsTable({
  students,
}: {
  students: StudentTableRow[];
}): React.JSX.Element {
  return (
    <div className="p-5">
      <DataTable
        columns={columns}
        data={students}
        emptyDescription="Voce ainda nao possui nenhum aluno cadastrado na plataforma."
        emptyTitle="Nenhum aluno encontrado"
        searchPlaceholder="Buscar por nome ou email"
      />
    </div>
  );
}

function StudentEnrollmentsDialog({
  student,
}: {
  student: StudentTableRow;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton size="sm" variant="outline">
        <HugeiconsIcon icon={ViewIcon} size={16} strokeWidth={2} />
        Ver
      </DialogTriggerButton>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{student.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {student.email}
              </DialogDescription>
            </div>
            <Badge
              variant={student.platformBlockedAt ? "destructive" : "outline"}
            >
              {student.platformBlockedAt ? "Bloqueado na Plataforma" : "Ativo"}
            </Badge>
          </div>

          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Primeiro acesso
              </span>
              <span className="font-medium">
                {formatNullableDate(student.firstEnrollmentAt)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Último acesso
              </span>
              <span className="font-medium">
                {formatNullableDate(student.lastAccessAt)}
              </span>
            </div>
            {student.platformBlockedReason && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-destructive text-xs">
                  Motivo do bloqueio
                </span>
                <span className="font-medium text-destructive">
                  {student.platformBlockedReason}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3">
            <StudentPlatformAccessControls student={student} />
            {student.enrollments.length ? (
              <StudentCoursesSummary enrollments={student.enrollments} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem matriculas</EmptyTitle>
                  <EmptyDescription>
                    Este aluno ainda nao possui matriculas ativas.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function StudentCoursesSummary({
  enrollments,
}: {
  enrollments: StudentEnrollmentRow[];
}): React.JSX.Element {
  return (
    <section className="mt-2">
      <header className="mb-3 px-1">
        <p className="font-semibold text-sm">Cursos matriculados</p>
      </header>
      <div className="grid gap-2">
        {enrollments.map((enrollment) => (
          <div
            className="flex items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/60"
            key={enrollment.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">
                {enrollment.courseTitle}
              </p>
              <p className="text-muted-foreground text-xs">
                Expira em {formatNullableDate(enrollment.expiresAt)}
              </p>
            </div>
            <Badge className="w-fit" variant="secondary">
              {enrollment.status}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StudentPlatformAccessControls({
  student,
}: {
  student: Pick<
    StudentTableRow,
    "email" | "name" | "platformBlockedAt" | "platformBlockedReason" | "userId"
  >;
}): React.JSX.Element {
  const isBlocked = Boolean(student.platformBlockedAt);

  return (
    <Accordion className="w-full" collapsible type="single">
      {isBlocked ? (
        <AccordionItem className="border-none" value="restore-access">
          <AccordionTrigger className="rounded-md px-4 py-3 text-sm hover:bg-muted/50 hover:no-underline data-[state=open]:bg-muted/30">
            Restaurar acesso na plataforma
          </AccordionTrigger>
          <AccordionContent className="border-t bg-muted/10 px-4 pt-4 pb-4">
            <AutoCloseDialogForm
              action={restoreStudentPlatformAccessAction}
              className="grid gap-5"
            >
              <input name="userId" type="hidden" value={student.userId} />
              <label className="grid gap-1.5">
                <span className="font-medium text-sm">
                  Motivo da restauração
                </span>
                <input
                  className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  name="reason"
                  placeholder="Ex.: conta revisada pelo suporte"
                  required
                />
              </label>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="outline">
                  <HugeiconsIcon icon={UndoIcon} size={16} strokeWidth={2} />
                  Restaurar na plataforma
                </Button>
              </div>
            </AutoCloseDialogForm>
          </AccordionContent>
        </AccordionItem>
      ) : (
        <AccordionItem className="border-none" value="block-access">
          <AccordionTrigger className="rounded-md px-4 py-3 text-sm hover:bg-destructive/5 hover:text-destructive hover:no-underline data-[state=open]:bg-destructive/5 data-[state=open]:text-destructive">
            Bloquear acesso na plataforma
          </AccordionTrigger>
          <AccordionContent className="border-destructive/10 border-t bg-destructive/5 px-4 pt-4 pb-4">
            <AutoCloseDialogForm
              action={blockStudentPlatformAccessAction}
              className="grid gap-5"
              id={`block-platform-${student.userId}`}
            >
              <input name="userId" type="hidden" value={student.userId} />
              <label className="grid gap-1.5">
                <span className="font-medium text-destructive text-sm">
                  Motivo do bloqueio
                </span>
                <input
                  className="rounded-md border-destructive/30 bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                  name="reason"
                  placeholder="Ex.: revisão de segurança da conta"
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
                      Bloquear na plataforma
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
                        O aluno perderá o acesso geral à plataforma e não
                        conseguirá mais fazer login. Essa ação afetará todos os
                        cursos. Deseja confirmar?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        form={`block-platform-${student.userId}`}
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
      )}
    </Accordion>
  );
}
