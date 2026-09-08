import { Money01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import type { CourseRevenueSummary } from "@/features/admin/server";
import { formatCurrencyInCents } from "@/lib/formatters";

export type CourseRevenueRow = CourseRevenueSummary;

interface CoursesRevenueTableProps {
  data: CourseRevenueRow[];
  hasNextPage: boolean;
  orderPage: number;
  orderSearch: string;
  page: number;
  pageSize: number;
  search: string;
  totalCount: number;
}

const formatPercent = (value: number): string =>
  `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)}%`;

const getPageHref = ({
  orderPage,
  orderSearch,
  page,
  search,
}: {
  orderPage: number;
  orderSearch: string;
  page: number;
  search: string;
}): string => {
  const params = new URLSearchParams();

  if (orderSearch) {
    params.set("q", orderSearch);
  }
  if (orderPage > 1) {
    params.set("page", String(orderPage));
  }
  if (search) {
    params.set("revenueQ", search);
  }
  if (page > 1) {
    params.set("revenuePage", String(page));
  }

  const query = params.toString();
  return query ? `/admin/financeiro?${query}` : "/admin/financeiro";
};

const getRevenueResultSummary = ({
  courseCount,
  page,
  pageSize,
  totalCount,
}: {
  courseCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return "Nenhum curso";
  }

  if (courseCount === 0) {
    return `Nenhum curso nesta página · ${totalCount} no total`;
  }

  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + courseCount - 1, totalCount);
  const plural = totalCount === 1 ? "" : "s";

  return `${firstResult}–${lastResult} de ${totalCount} curso${plural}`;
};

export function CoursesRevenueTable({
  data,
  hasNextPage,
  orderPage,
  orderSearch,
  page,
  pageSize,
  search,
  totalCount,
}: CoursesRevenueTableProps): React.JSX.Element {
  const resultSummary = getRevenueResultSummary({
    courseCount: data.length,
    page,
    pageSize,
    totalCount,
  });

  const searchForm = (
    <form
      action="/admin/financeiro"
      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      method="get"
    >
      <label className="sr-only" htmlFor="financial-revenue-search">
        Filtrar receita por curso
      </label>
      <input name="q" type="hidden" value={orderSearch} />
      <input name="page" type="hidden" value={orderPage} />
      <input name="revenuePage" type="hidden" value="1" />
      <Input
        aria-label="Filtrar receita por curso"
        className="max-w-sm"
        defaultValue={search}
        id="financial-revenue-search"
        name="revenueQ"
        placeholder="Filtrar por nome do curso…"
      />
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span aria-live="polite">{resultSummary}</span>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-4">
      {searchForm}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableCaption className="sr-only">
            Receita agregada por curso
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Curso</TableHead>
              <TableHead className="whitespace-nowrap text-right" scope="col">
                Vendas concluídas
              </TableHead>
              <TableHead className="whitespace-nowrap text-right" scope="col">
                Conversão
              </TableHead>
              <TableHead className="whitespace-nowrap text-right" scope="col">
                Receita real
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((course) => {
                const conversion =
                  course.totalOrders > 0
                    ? (course.paidOrders / course.totalOrders) * 100
                    : 0;

                return (
                  <TableRow key={course.courseId}>
                    <TableRowHeader className="font-semibold">
                      {course.courseTitle}
                    </TableRowHeader>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {course.paidOrders} / {course.totalOrders}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatPercent(conversion)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatCurrencyInCents(course.totalRevenueInCents)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="h-48 p-0" colSpan={4}>
                  <Empty className="rounded-none border-0 border-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon aria-hidden="true" icon={Money01Icon} />
                      </EmptyMedia>
                      <EmptyTitle as="h3">
                        {search
                          ? "Nenhum curso encontrado"
                          : "Nenhum faturamento registrado"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {search
                          ? `A busca por “${search}” não retornou cursos.`
                          : "Ainda não há vendas de cursos processadas neste período."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {page > 1 || hasNextPage ? (
        <nav
          aria-label="Paginação de receita por curso"
          className="flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link
                href={getPageHref({
                  orderPage,
                  orderSearch,
                  page: page - 1,
                  search,
                })}
              >
                Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {hasNextPage ? (
            <Button asChild variant="outline">
              <Link
                href={getPageHref({
                  orderPage,
                  orderSearch,
                  page: page + 1,
                  search,
                })}
              >
                Próxima
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
