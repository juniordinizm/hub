"use client";

import { Money01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyInCents } from "@/lib/formatters";

export interface CourseRevenueRow {
  courseId: string;
  courseTitle: string;
  paidOrders: number;
  totalOrders: number;
  totalRevenueInCents: number;
}

const columns: ColumnDef<CourseRevenueRow>[] = [
  {
    accessorKey: "courseTitle",
    header: "Curso",
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.courseTitle}</span>
    ),
  },
  {
    accessorKey: "paidOrders",
    header: "Vendas Concluídas",
    cell: ({ row }) => (
      <span>
        {row.original.paidOrders} / {row.original.totalOrders}
      </span>
    ),
  },
  {
    id: "conversion",
    header: "Conversão",
    cell: ({ row }) => {
      const { totalOrders, paidOrders } = row.original;
      const rate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;
      return <span>{rate.toFixed(1)}%</span>;
    },
  },
  {
    accessorKey: "totalRevenueInCents",
    header: "Receita Real",
    cell: ({ row }) => (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">
        {formatCurrencyInCents(row.original.totalRevenueInCents)}
      </span>
    ),
  },
];

export function CoursesRevenueTable({
  data,
}: {
  data: CourseRevenueRow[];
}): React.JSX.Element {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    state: {
      globalFilter,
    },
  });

  const pageSize = String(table.getState().pagination.pageSize);
  const visibleRows = table.getRowModel().rows;
  const filteredRowsCount = table.getFilteredRowModel().rows.length;
  const pageLabel = useMemo(
    () =>
      `Página ${table.getState().pagination.pageIndex + 1} de ${Math.max(
        table.getPageCount(),
        1
      )}`,
    [table]
  );

  if (data.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Money01Icon} />
          </EmptyMedia>
          <EmptyTitle>Nenhum faturamento registrado</EmptyTitle>
          <EmptyDescription>
            Ainda não há vendas de cursos processadas neste período.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          className="max-w-sm"
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filtrar por nome do curso..."
          value={globalFilter}
        />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>{filteredRowsCount} curso(s) filtrado(s)</span>
          <Select
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={pageSize}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 por página</SelectItem>
              <SelectItem value="10">10 por página</SelectItem>
              <SelectItem value="20">20 por página</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-64 p-0" colSpan={columns.length}>
                  <Empty className="rounded-none border-0 border-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={Search01Icon} />
                      </EmptyMedia>
                      <EmptyTitle>Nenhum curso encontrado</EmptyTitle>
                      <EmptyDescription>
                        A busca por &quot;{globalFilter}&quot; não retornou
                        resultados.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground text-sm">{pageLabel}</p>
        {table.getPageCount() > 1 && (
          <div className="flex gap-2">
            <Button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              type="button"
              variant="outline"
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
