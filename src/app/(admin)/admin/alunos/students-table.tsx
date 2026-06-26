"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEnrollmentAction } from "@/features/admin/actions";

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
        emptyDescription="Você ainda não possui nenhum aluno cadastrado na plataforma."
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
                <AutoCloseDialogForm
                  action={updateEnrollmentAction}
                  className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_140px_150px_auto]"
                  id={`form-enrollment-${enrollment.id}`}
                  key={enrollment.id}
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <input name="userId" type="hidden" value={student.userId} />
                  <div>
                    <p className="font-semibold">{enrollment.courseTitle}</p>
                    <p className="text-muted-foreground text-xs">
                      Matricula: {formatDate(enrollment.startedAt)}
                    </p>
                  </div>
                  <Select defaultValue={enrollment.status} name="status">
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="expired">Expirada</SelectItem>
                      <SelectItem value="revoked">Revogada</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    name="expiresAt"
                    type="hidden"
                    value={
                      enrollment.expiresAt instanceof Date
                        ? enrollment.expiresAt.toISOString()
                        : enrollment.expiresAt
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button">Atualizar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
                        <AlertDialogDescription>
                          Você está prestes a alterar o status da matrícula. Tem
                          certeza que deseja continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          form={`form-enrollment-${enrollment.id}`}
                          type="submit"
                        >
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </AutoCloseDialogForm>
              ))
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem matrículas</EmptyTitle>
                  <EmptyDescription>
                    Este aluno ainda não possui matrículas ativas.
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
