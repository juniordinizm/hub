"use client";

import { Search01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyDescription?: string;
  emptyTitle?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyTitle = "Nenhum resultado encontrado",
  emptyDescription = "Nenhum registro disponível.",
  showSearch = true,
  searchPlaceholder = "Buscar...",
}: DataTableProps<TData, TValue>): React.JSX.Element {
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
        pageSize: 10,
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
      `Pagina ${table.getState().pagination.pageIndex + 1} de ${Math.max(
        table.getPageCount(),
        1
      )}`,
    [table]
  );

  if (data.length === 0 && !globalFilter) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={UserMultipleIcon} />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 px-5 pt-4 md:flex-row md:items-center md:justify-between">
        {showSearch ? (
          <Input
            className="max-w-sm"
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            value={globalFilter}
          />
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>{filteredRowsCount} registro(s)</span>
          <Select
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={pageSize}
          >
            <SelectTrigger aria-label="Itens por página" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 por pagina</SelectItem>
              <SelectItem value="20">20 por pagina</SelectItem>
              <SelectItem value="50">50 por pagina</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-y">
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
                      <EmptyTitle>Nenhum resultado encontrado</EmptyTitle>
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

      <div className="flex flex-col gap-3 px-5 pb-4 md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground text-sm">{pageLabel}</p>
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
            Proxima
          </Button>
        </div>
      </div>
    </div>
  );
}
