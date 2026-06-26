"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
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
import { EnrollmentExpirationControls } from "@/features/admin/enrollment-expiration-controls";

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
                  enrollment={{
                    ...enrollment,
                    userId: student.userId,
                  }}
                  key={enrollment.id}
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
