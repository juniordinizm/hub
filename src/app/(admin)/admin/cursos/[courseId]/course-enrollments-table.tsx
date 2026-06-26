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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEnrollmentAction } from "@/features/admin/actions";
import type { getAdminManagementData } from "@/features/admin/server";

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
export type CourseEnrollmentRow = AdminData["enrollments"][number];

const formatDate = (value: Date | string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(value)
  );
};

const columns: ColumnDef<CourseEnrollmentRow>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-muted-foreground text-xs">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "startsAt",
    header: "Matricula",
    cell: ({ row }) => formatDate(row.original.startsAt),
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    cell: ({ row }) => formatDate(row.original.expiresAt),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => <EnrollmentEditDialog enrollment={row.original} />,
  },
];

export function CourseEnrollmentsTable({
  enrollments,
}: {
  enrollments: CourseEnrollmentRow[];
}): React.JSX.Element {
  return (
    <DataTable
      columns={columns}
      data={enrollments}
      emptyDescription="Este curso ainda não possui alunos matriculados."
      emptyTitle="Nenhuma matrícula encontrada"
      searchPlaceholder="Buscar por nome ou email"
    />
  );
}

function EnrollmentEditDialog({
  enrollment,
}: {
  enrollment: CourseEnrollmentRow;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton size="sm" variant="outline">
        <HugeiconsIcon icon={ViewIcon} size={16} strokeWidth={2} />
        Ver
      </DialogTriggerButton>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{enrollment.name}</DialogTitle>
          <DialogDescription>
            {enrollment.email} - Matrícula em {enrollment.courseTitle}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <AutoCloseDialogForm
            action={updateEnrollmentAction}
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_140px_150px_auto]"
            id={`form-enrollment-${enrollment.id}`}
          >
            <input name="enrollmentId" type="hidden" value={enrollment.id} />
            <input name="userId" type="hidden" value={enrollment.userId} />
            <div>
              <p className="font-semibold">{enrollment.courseTitle}</p>
              <p className="text-muted-foreground text-xs">
                Matricula: {formatDate(enrollment.startsAt)}
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
