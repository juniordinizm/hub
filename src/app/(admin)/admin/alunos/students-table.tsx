"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
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
  hasNextPage = false,
  page = 1,
  search = "",
}: {
  hasNextPage?: boolean;
  students: StudentTableRow[];
  page?: number;
  search?: string;
}): React.JSX.Element {
  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (search) {
      params.set("q", search);
    }
    params.set("page", String(targetPage));
    return `/admin/alunos?${params.toString()}`;
  };

  return (
    <div className="p-5">
      <form
        action="/admin/alunos"
        className="mb-4 flex max-w-xl gap-2"
        method="get"
      >
        <input name="page" type="hidden" value="1" />
        <Input
          aria-label="Buscar alunos"
          className="min-w-0 flex-1"
          defaultValue={search}
          name="q"
          placeholder="Buscar por nome ou e-mail"
        />
        <Button type="submit">Buscar</Button>
      </form>
      <DataTable
        columns={columns}
        data={students}
        emptyDescription="Voce ainda nao possui nenhum aluno cadastrado na plataforma."
        emptyTitle="Nenhum aluno encontrado"
        showSearch={false}
      />
      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <span className="text-muted-foreground text-sm">Pagina {page}</span>
        <div className="flex gap-2">
          <Button asChild disabled={page <= 1} variant="outline">
            <Link href={pageHref(Math.max(1, page - 1))}>Anterior</Link>
          </Button>
          <Button asChild disabled={!hasNextPage} variant="outline">
            <Link href={pageHref(page + 1)}>Proxima</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
