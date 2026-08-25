"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StudentManagementSheet } from "@/components/admin/student-management-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { SupportCourseStudentSummary } from "@/features/admin/support-server";
import { formatDateTime } from "@/lib/formatters";

interface SupportCourseStudentRow extends SupportCourseStudentSummary {
  courseId: string;
}

const supportCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentSupport: true,
  canManagePlatformAccess: false,
  canReissueCertificates: true,
} as const;

const columns: ColumnDef<SupportCourseStudentRow>[] = [
  {
    accessorKey: "name",
    header: "Aluna",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-muted-foreground text-xs">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "startsAt",
    header: "Matrícula",
    cell: ({ row }) => formatDateTime(row.original.startsAt),
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    cell: ({ row }) => formatDateTime(row.original.expiresAt),
  },
  {
    accessorKey: "enrollmentStatus",
    header: "Acesso",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{row.original.enrollmentStatus}</Badge>
        {row.original.platformBlocked ? (
          <Badge variant="destructive">Plataforma bloqueada</Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Ações",
    cell: ({ row }) => {
      const courseId = encodeURIComponent(row.original.courseId);
      const userId = encodeURIComponent(row.original.userId);

      return (
        <StudentManagementSheet
          capabilities={supportCapabilities}
          courseId={row.original.courseId}
          dataUrl={`/api/admin/operations/courses/${courseId}/students/${userId}`}
          trigger={
            <Button size="sm" variant="outline">
              <HugeiconsIcon
                data-icon="inline-start"
                icon={ViewIcon}
                size={16}
                strokeWidth={2}
              />
              Consultar
            </Button>
          }
          userId={row.original.userId}
        />
      );
    },
  },
];

export function SupportCourseStudentsTable({
  courseId,
  students,
}: {
  courseId: string;
  students: SupportCourseStudentSummary[];
}): React.JSX.Element {
  return (
    <DataTable
      columns={columns}
      data={students.map((student) => ({ ...student, courseId }))}
      emptyDescription="Este Curso ainda não possui alunas matriculadas."
      emptyTitle="Nenhuma matrícula encontrada"
      searchPlaceholder="Buscar por nome ou email"
    />
  );
}
