"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumnMeta {
  align?: "left" | "center" | "right";
  nowrap?: boolean;
  numeric?: boolean;
  rowHeader?: boolean;
}

const getColumnMeta = <TData, TValue>(
  column: Column<TData, TValue>
): DataTableColumnMeta =>
  (column.columnDef.meta as DataTableColumnMeta | undefined) ?? {};

const getAlignmentClassName = (
  meta: DataTableColumnMeta
): string | undefined => {
  const classNames: string[] = [];

  if (meta.align === "center") {
    classNames.push("text-center");
  } else if (meta.align === "right" || meta.numeric) {
    classNames.push("text-right");
  }

  if (meta.numeric) {
    classNames.push("tabular-nums");
  }

  if (meta.nowrap || meta.numeric) {
    classNames.push("whitespace-nowrap");
  }

  return classNames.length > 0 ? cn(classNames) : undefined;
};

interface DataTableProps<TData, TValue> {
  caption: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyDescription?: string;
  emptyTitle?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  showPagination?: boolean;
  showSearch?: boolean;
}

export function DataTable<TData, TValue>({
  caption,
  columns,
  data,
  emptyTitle = "Nenhum resultado encontrado",
  emptyDescription = "Nenhum registro disponível.",
  showPagination = true,
  showSearch = true,
  searchLabel = "Buscar na tabela",
  searchPlaceholder = "Buscar…",
}: DataTableProps<TData, TValue>): React.JSX.Element {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(showPagination
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
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
  const shouldShowPagination = showPagination && data.length > 0;
  const pageLabel = `Página ${table.getState().pagination.pageIndex + 1} de ${Math.max(
    table.getPageCount(),
    1
  )}`;

  return (
    <div className="flex flex-col gap-4">
      {showSearch || shouldShowPagination ? (
        <div className="flex flex-col gap-3 border-b bg-muted/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          {showSearch ? (
            <Input
              aria-label={searchLabel}
              autoComplete="off"
              className="max-w-sm"
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              value={globalFilter}
            />
          ) : null}
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span aria-live="polite">{filteredRowsCount} registro(s)</span>
            {shouldShowPagination ? (
              <Select
                onValueChange={(value) => table.setPageSize(Number(value))}
                value={pageSize}
              >
                <SelectTrigger
                  aria-label="Itens por página"
                  className="w-[120px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 por página</SelectItem>
                  <SelectItem value="20">20 por página</SelectItem>
                  <SelectItem value="50">50 por página</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "border-border/60",
          showSearch || shouldShowPagination ? "border-b" : "border-y"
        )}
      >
        <Table>
          <TableCaption>{caption}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={getAlignmentClassName(
                      getColumnMeta(header.column)
                    )}
                    key={header.id}
                  >
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
                  {row.getVisibleCells().map((cell) => {
                    const meta = getColumnMeta(cell.column);
                    const cellContent = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    );
                    const className = getAlignmentClassName(meta);

                    return meta.rowHeader ? (
                      <TableRowHeader className={className} key={cell.id}>
                        {cellContent}
                      </TableRowHeader>
                    ) : (
                      <TableCell className={className} key={cell.id}>
                        {cellContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-64 p-0" colSpan={columns.length}>
                  <Empty className="rounded-none border-0 border-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon aria-hidden="true" icon={Search01Icon} />
                      </EmptyMedia>
                      <EmptyTitle as="h3">
                        {data.length === 0 && !globalFilter
                          ? emptyTitle
                          : "Nenhum resultado encontrado"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {data.length === 0 && !globalFilter ? (
                          emptyDescription
                        ) : (
                          <>
                            A busca por &quot;{globalFilter}&quot; não retornou
                            resultados.
                          </>
                        )}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {shouldShowPagination ? (
        <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between">
          <p aria-live="polite" className="text-muted-foreground text-xs">
            {pageLabel}
          </p>
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
        </div>
      ) : null}
    </div>
  );
}
