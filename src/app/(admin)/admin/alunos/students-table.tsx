"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { StudentManagementSheet } from "@/components/admin/student-management-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { formatShortDate } from "@/lib/formatters";

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

const formatNullableDate = (value: string | null): string => {
  if (!value) {
    return "Sem registro";
  }

  return formatShortDate(value);
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
    cell: ({ row }) => formatNullableDate(row.original.latestExpiration),
  },
  {
    accessorKey: "lastAccessAt",
    header: "Ultimo acesso",
    cell: ({ row }) => formatNullableDate(row.original.lastAccessAt),
  },
  {
    id: "actions",
    header: "Acoes",
    cell: ({ row }) => (
      <StudentManagementSheet
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
