"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
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
  extendEnrollmentExpirationAction,
  setEnrollmentExpirationAction,
} from "@/features/admin/actions";

export interface StudentEnrollmentRow {
  courseTitle: string;
  expiresAt: string;
  id: string;
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
  name: string;
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
    accessorKey: "firstEnrollmentAt",
    header: "Matricula",
    cell: ({ row }) => formatDate(row.original.firstEnrollmentAt),
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

function EnrollmentExpirationControls({
  enrollment,
  userId,
}: {
  enrollment: StudentEnrollmentRow;
  userId: string;
}): React.JSX.Element {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div>
        <p className="font-semibold">{enrollment.courseTitle}</p>
        <p className="text-muted-foreground text-xs">
          Matricula: {formatDate(enrollment.startedAt)} | Expira:{" "}
          {formatDate(enrollment.expiresAt)} | {enrollment.status}
        </p>
      </div>
      <AutoCloseDialogForm
        action={extendEnrollmentExpirationAction}
        className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
      >
        <input name="enrollmentId" type="hidden" value={enrollment.id} />
        <input name="userId" type="hidden" value={userId} />
        <input
          aria-label="Motivo da extensao"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          name="reason"
          placeholder="Motivo obrigatorio"
          required
        />
        <Button name="days" type="submit" value="1">
          +1 dia
        </Button>
        <Button name="days" type="submit" value="7">
          +7 dias
        </Button>
        <Button name="months" type="submit" value="1">
          +1 mes
        </Button>
      </AutoCloseDialogForm>
      <AutoCloseDialogForm
        action={setEnrollmentExpirationAction}
        className="grid gap-2 md:grid-cols-[1fr_180px_auto]"
      >
        <input name="enrollmentId" type="hidden" value={enrollment.id} />
        <input name="userId" type="hidden" value={userId} />
        <input
          aria-label="Motivo da data exata"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          name="reason"
          placeholder="Motivo obrigatorio"
          required
        />
        <input
          aria-label="Nova expiracao com horario local"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          name="newExpiresAt"
          required
          type="datetime-local"
        />
        <Button type="submit">Definir data</Button>
      </AutoCloseDialogForm>
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
            {student.email} - {student.courseCount} curso
            {student.courseCount === 1 ? "" : "s"} matriculado
            {student.courseCount === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3">
            {student.enrollments.length ? (
              student.enrollments.map((enrollment) => (
                <EnrollmentExpirationControls
                  enrollment={enrollment}
                  key={enrollment.id}
                  userId={student.userId}
                />
              ))
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
