"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StudentManagementSheet } from "@/components/admin/student-management-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AdminEnrollment } from "@/features/admin/server";
import { formatDateTime as formatAppDateTime } from "@/lib/formatters";

export type CourseEnrollmentRow = AdminEnrollment;

const formatNullableDateTime = (value: Date | string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return formatAppDateTime(value);
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
    cell: ({ row }) => formatNullableDateTime(row.original.startsAt),
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    cell: ({ row }) => formatNullableDateTime(row.original.expiresAt),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => (
      <StudentManagementSheet
        capabilities={{
          canManageCertificates: true,
          canManageEnrollmentSupport: true,
          canManagePlatformAccess: true,
          canReissueCertificates: true,
        }}
        courseId={row.original.courseId}
        trigger={
          <Button size="sm" variant="outline">
            <HugeiconsIcon
              data-icon="inline-start"
              icon={ViewIcon}
              size={16}
              strokeWidth={2}
            />
            Gerenciar
          </Button>
        }
        userId={row.original.userId}
      />
    ),
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
