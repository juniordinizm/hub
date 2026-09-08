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
import type { AdminEnrollment } from "@/features/admin/server";
import { getEnrollmentStatusPresentation } from "@/features/admin/status-presentation";
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
    meta: { rowHeader: true },
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {row.original.email}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "startsAt",
    header: "Matrícula",
    meta: { align: "right", nowrap: true },
    cell: ({ row }) => formatNullableDateTime(row.original.startsAt),
  },
  {
    accessorKey: "expiresAt",
    header: "Expira em",
    meta: { align: "right", nowrap: true },
    cell: ({ row }) => formatNullableDateTime(row.original.expiresAt),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const presentation = getEnrollmentStatusPresentation(row.original.status);

      return (
        <Badge
          aria-label={`Status: ${presentation.label}`}
          variant={presentation.variant}
        >
          {presentation.label}
        </Badge>
      );
    },
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
        courseId={row.original.courseId}
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

const getEnrollmentResultSummary = ({
  enrollmentCount,
  page,
  pageSize,
  totalCount,
}: {
  enrollmentCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return "Nenhuma matrícula";
  }

  if (enrollmentCount === 0) {
    return `Nenhuma matrícula nesta página · ${totalCount} no total`;
  }

  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + enrollmentCount - 1, totalCount);
  const plural = totalCount === 1 ? "" : "s";

  return `${firstResult}–${lastResult} de ${totalCount} matrícula${plural}`;
};

export function CourseEnrollmentsTable({
  courseId,
  enrollments,
  hasNextPage = false,
  page = 1,
  pageSize = 50,
  search = "",
  totalCount = enrollments.length,
}: {
  courseId: string;
  enrollments: CourseEnrollmentRow[];
  hasNextPage?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
  totalCount?: number;
}): React.JSX.Element {
  const resultSummary = getEnrollmentResultSummary({
    enrollmentCount: enrollments.length,
    page,
    pageSize,
    totalCount,
  });

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams({ tab: "students" });
    if (search) {
      params.set("enrollmentQ", search);
    }
    if (targetPage > 1) {
      params.set("enrollmentPage", String(targetPage));
    }
    return `/admin/cursos/${encodeURIComponent(courseId)}?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        action={`/admin/cursos/${encodeURIComponent(courseId)}`}
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        method="get"
      >
        <label className="sr-only" htmlFor="course-enrollment-search">
          Buscar matrículas
        </label>
        <input name="tab" type="hidden" value="students" />
        <input name="enrollmentPage" type="hidden" value="1" />
        <Input
          aria-label="Buscar matrículas"
          autoComplete="off"
          className="max-w-sm"
          defaultValue={search}
          id="course-enrollment-search"
          name="enrollmentQ"
          placeholder="Buscar por nome ou e-mail…"
        />
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span aria-live="polite">{resultSummary}</span>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </div>
      </form>

      <DataTable
        caption="Matrículas do curso"
        columns={columns}
        data={enrollments}
        emptyDescription={
          search
            ? `A busca por “${search}” não retornou matrículas.`
            : "Este Curso ainda não possui Alunas matriculadas."
        }
        emptyTitle={
          search ? "Nenhuma matrícula encontrada" : "Nenhuma matrícula"
        }
        showPagination={false}
        showSearch={false}
      />

      {page > 1 || hasNextPage ? (
        <nav
          aria-label="Paginação de matrículas do curso"
          className="flex items-center justify-between gap-3 border-t pt-3"
        >
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={pageHref(page - 1)}>Anterior</Link>
            </Button>
          ) : (
            <span />
          )}
          {hasNextPage ? (
            <Button asChild variant="outline">
              <Link href={pageHref(page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
