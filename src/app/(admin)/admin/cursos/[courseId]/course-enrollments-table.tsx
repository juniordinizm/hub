"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
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
  extendEnrollmentExpirationAction,
  setEnrollmentExpirationAction,
} from "@/features/admin/actions";
import type { getAdminManagementData } from "@/features/admin/server";

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
export type CourseEnrollmentRow = AdminData["enrollments"][number];

const formatDate = (value: Date | string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
      emptyDescription="Este curso ainda nao possui alunos matriculados."
      emptyTitle="Nenhuma matricula encontrada"
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
            {enrollment.email} - Matricula em {enrollment.courseTitle}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3 rounded-lg border p-3">
            <div>
              <p className="font-semibold">{enrollment.courseTitle}</p>
              <p className="text-muted-foreground text-xs">
                Matricula: {formatDate(enrollment.startsAt)} | Expira:{" "}
                {formatDate(enrollment.expiresAt)} | {enrollment.status}
              </p>
            </div>
            <AutoCloseDialogForm
              action={extendEnrollmentExpirationAction}
              className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
            >
              <input name="enrollmentId" type="hidden" value={enrollment.id} />
              <input name="userId" type="hidden" value={enrollment.userId} />
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
              <input name="userId" type="hidden" value={enrollment.userId} />
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
