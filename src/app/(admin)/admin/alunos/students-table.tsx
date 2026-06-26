"use client";

import {
  SquareLock02Icon,
  UndoIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
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

const formatDate = (value: string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(value)
  );
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
    cell: ({ row }) => formatDate(row.original.latestExpiration),
  },
  {
    accessorKey: "lastAccessAt",
    header: "Ultimo acesso",
    cell: ({ row }) => formatDate(row.original.lastAccessAt),
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
        <DialogHeader>
          <DialogTitle>{student.name}</DialogTitle>
          <DialogDescription>
            Gerencie a conta do aluno na plataforma.
          </DialogDescription>
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
    <section className="overflow-hidden rounded-md border bg-background">
      <header className="border-b p-4">
        <p className="font-semibold">Cursos matriculados</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Resumo dos cursos do aluno. Ajustes de curso ficam dentro do curso.
        </p>
      </header>
      <div className="divide-y">
        {enrollments.map((enrollment) => (
          <div
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={enrollment.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{enrollment.courseTitle}</p>
              <p className="text-muted-foreground text-xs">
                Expira em {formatDate(enrollment.expiresAt)}
              </p>
            </div>
            <Badge className="w-fit" variant="outline">
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
    <section className="overflow-hidden rounded-md border bg-background">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">Acesso a plataforma</p>
          <p className="mt-1 text-muted-foreground text-sm">{student.email}</p>
          {student.platformBlockedReason ? (
            <p className="mt-2 text-muted-foreground text-xs">
              Motivo: {student.platformBlockedReason}
            </p>
          ) : null}
        </div>
        <Badge
          className="w-fit"
          variant={isBlocked ? "destructive" : "outline"}
        >
          {isBlocked ? "Bloqueado" : "Ativo"}
        </Badge>
      </header>

      {isBlocked ? (
        <AutoCloseDialogForm
          action={restoreStudentPlatformAccessAction}
          className="grid gap-4 p-4"
        >
          <input name="userId" type="hidden" value={student.userId} />
          <label className="grid gap-1.5">
            <span className="font-medium text-sm">Motivo da restauracao</span>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              name="reason"
              placeholder="Ex.: conta revisada pelo suporte"
              required
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="outline">
              <HugeiconsIcon icon={UndoIcon} size={16} strokeWidth={2} />
              Restaurar na plataforma
            </Button>
          </div>
        </AutoCloseDialogForm>
      ) : (
        <AutoCloseDialogForm
          action={blockStudentPlatformAccessAction}
          className="grid gap-4 p-4"
        >
          <input name="userId" type="hidden" value={student.userId} />
          <label className="grid gap-1.5">
            <span className="font-medium text-sm">Motivo do bloqueio</span>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              name="reason"
              placeholder="Ex.: revisao de seguranca da conta"
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
              Bloquear na plataforma
            </Button>
          </div>
        </AutoCloseDialogForm>
      )}
    </section>
  );
}
