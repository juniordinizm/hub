"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
  EnrollmentExpirationControls,
  formatDateTime,
  statusLabels,
} from "@/features/admin/enrollment-expiration-controls";
import type { AdminEnrollment } from "@/features/admin/server";

export type CourseEnrollmentRow = AdminEnrollment;

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
  let badgeVariant: "default" | "destructive" | "secondary" = "default";
  if (enrollment.status === "revoked") {
    badgeVariant = "destructive";
  } else if (enrollment.status === "expired") {
    badgeVariant = "secondary";
  }

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
              <DialogTitle className="text-xl">{enrollment.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {enrollment.email} - Matrícula em {enrollment.courseTitle}
              </DialogDescription>
            </div>
            <Badge variant={badgeVariant}>
              {statusLabels[enrollment.status] ?? enrollment.status}
            </Badge>
          </div>

          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Início</span>
              <span className="font-medium">
                {formatDateTime(enrollment.startsAt)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Expiração original
              </span>
              <span className="font-medium">
                {formatDateTime(enrollment.originalExpiresAt)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Expiração atual
              </span>
              <span className="font-medium">
                {formatDateTime(enrollment.expiresAt)}
              </span>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <EnrollmentExpirationControls
            enrollment={{
              courseTitle: enrollment.courseTitle,
              expiresAt: enrollment.expiresAt,
              id: enrollment.id,
              originalExpiresAt: enrollment.originalExpiresAt,
              revokedReason: enrollment.revokedReason,
              startedAt: enrollment.startsAt,
              status: enrollment.status,
              userId: enrollment.userId,
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
