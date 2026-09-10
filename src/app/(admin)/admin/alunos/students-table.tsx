"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { AdminSearchPill } from "@/components/admin/admin-search-pill";
import { StudentManagementSheet } from "@/components/admin/student-management-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
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

const getStudentResultSummary = ({
  page,
  pageSize,
  studentCount,
  totalCount,
}: {
  page: number;
  pageSize: number;
  studentCount: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return "Nenhuma Aluna";
  }

  if (studentCount === 0) {
    return `Nenhuma Aluna nesta página · ${totalCount} no total`;
  }

  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + studentCount - 1, totalCount);
  const plural = totalCount === 1 ? "" : "s";

  return `${firstResult}–${lastResult} de ${totalCount} aluna${plural}`;
};

const columns: ColumnDef<StudentTableRow>[] = [
  {
    accessorKey: "name",
    header: "Nome",
    meta: { rowHeader: true },
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="break-all text-sm">{row.original.email}</span>
    ),
  },
  {
    accessorKey: "courseCount",
    header: "Cursos",
    meta: { numeric: true },
    cell: ({ row }) => <span>{row.original.courseCount}</span>,
  },
  {
    accessorKey: "platformBlockedAt",
    header: "Plataforma",
    cell: ({ row }) =>
      row.original.platformBlockedAt ? (
        <Badge variant="destructive">Bloqueado</Badge>
      ) : (
        <Badge variant="success">Ativo</Badge>
      ),
  },
  {
    accessorKey: "latestExpiration",
    header: "Expiração final",
    meta: { align: "right", nowrap: true },
    cell: ({ row }) => formatNullableDate(row.original.latestExpiration),
  },
  {
    accessorKey: "lastAccessAt",
    header: "Último acesso",
    meta: { align: "right", nowrap: true },
    cell: ({ row }) => formatNullableDate(row.original.lastAccessAt),
  },
  {
    id: "actions",
    header: "Ações",
    meta: { align: "right", nowrap: true },
    cell: ({ row }) => (
      <StudentManagementSheet
        capabilities={{
          canManageCertificates: true,
          canManageEnrollmentAccess: true,
          canManageEnrollmentSupport: true,
          canManagePlatformAccess: true,
          canReissueCertificates: true,
        }}
        trigger={
          <Button
            aria-label={`Gerenciar ${row.original.name}`}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
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
  hasNextPage = false,
  page = 1,
  pageSize = 100,
  search = "",
  totalCount = students.length,
}: {
  hasNextPage?: boolean;
  pageSize?: number;
  students: StudentTableRow[];
  page?: number;
  search?: string;
  totalCount?: number;
}): React.JSX.Element {
  const resultSummary = getStudentResultSummary({
    page,
    pageSize,
    studentCount: students.length,
    totalCount,
  });

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (search) {
      params.set("q", search);
    }
    params.set("page", String(targetPage));
    return `/admin/alunos?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          action="/admin/alunos"
          className="flex min-w-0 flex-1 basis-full gap-2 sm:max-w-xl sm:basis-auto"
          method="get"
        >
          <input name="page" type="hidden" value="1" />
          <Input
            aria-label="Buscar Alunas"
            autoComplete="off"
            className="min-w-0 flex-1"
            defaultValue={search}
            name="q"
            placeholder="Buscar por nome ou e-mail…"
          />
          <Button type="submit">Buscar</Button>
        </form>
        {search ? (
          <AdminSearchPill href="/admin/alunos" value={search} />
        ) : null}
      </div>
      <DataTable
        caption="Alunas cadastradas"
        columns={columns}
        data={students}
        emptyDescription={
          search
            ? `A busca por “${search}” não retornou Alunas.`
            : "Você ainda não possui nenhuma Aluna cadastrada na plataforma."
        }
        emptyTitle={search ? "Nenhuma Aluna encontrada" : "Nenhuma Aluna"}
        showPagination={false}
        showSearch={false}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span aria-live="polite" className="text-muted-foreground text-sm">
          {resultSummary}
        </span>
        {page > 1 || hasNextPage ? (
          <nav aria-label="Paginação de Alunas" className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            ) : null}
            {hasNextPage ? (
              <Button asChild variant="outline">
                <Link href={pageHref(page + 1)}>Próxima</Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
