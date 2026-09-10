"use client";

import type { StudentActionMenuStudent } from "@/components/admin/student-actions-menu";
import { StudentActionsMenu } from "@/components/admin/student-actions-menu";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { getEnrollmentStatusPresentation } from "@/features/admin/status-presentation";
import type { SupportCourseStudentSummary } from "@/features/admin/support-server";

interface SupportCourseStudentRow extends SupportCourseStudentSummary {
  courseId: string;
}

const supportEnrollmentCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentAccess: false,
  canManageEnrollmentSupport: true,
  canManagePlatformAccess: false,
  canReissueCertificates: false,
} as const;

const supportCertificateCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentAccess: false,
  canManageEnrollmentSupport: false,
  canManagePlatformAccess: false,
  canReissueCertificates: true,
} as const;

const toStudentTableRow = (
  student: SupportCourseStudentRow
): StudentActionMenuStudent => ({
  email: student.email,
  name: student.name,
  platformBlockedAt: student.platformBlocked ? "blocked" : null,
  platformBlockedReason: null,
  userId: student.userId,
});

const columns = [
  {
    accessorKey: "name",
    header: "Nome",
    meta: { rowHeader: true },
    cell: ({ row }: { row: { original: SupportCourseStudentRow } }) => (
      <span className="block max-w-[220px] truncate font-medium">
        {row.original.name}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: "E-mail",
    cell: ({ row }: { row: { original: SupportCourseStudentRow } }) => (
      <span className="block max-w-[260px] truncate">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "enrollmentStatus",
    header: "Status",
    cell: ({ row }: { row: { original: SupportCourseStudentRow } }) => {
      const presentation = getEnrollmentStatusPresentation(
        row.original.enrollmentStatus
      );

      return (
        <div className="flex flex-wrap gap-2">
          <Badge
            aria-label={`Status da matrícula: ${presentation.label}`}
            variant={presentation.variant}
          >
            {presentation.label}
          </Badge>
          {row.original.platformBlocked ? (
            <Badge variant="destructive">Plataforma bloqueada</Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "Ações",
    meta: { align: "right", nowrap: true },
    cell: ({ row }: { row: { original: SupportCourseStudentRow } }) => {
      const courseId = encodeURIComponent(row.original.courseId);
      const userId = encodeURIComponent(row.original.userId);

      return (
        <StudentActionsMenu
          certificateCapabilities={supportCertificateCapabilities}
          courseId={row.original.courseId}
          dataUrl={`/api/admin/operations/courses/${courseId}/students/${userId}`}
          enrollmentCapabilities={supportEnrollmentCapabilities}
          student={toStudentTableRow(row.original)}
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
      caption="Alunos matriculadas no curso"
      columns={columns}
      data={students.map((student) => ({ ...student, courseId }))}
      emptyDescription="Este Curso ainda não possui alunos matriculados."
      emptyTitle="Nenhuma matrícula encontrada"
      showPagination={false}
      showSearch={false}
    />
  );
}
