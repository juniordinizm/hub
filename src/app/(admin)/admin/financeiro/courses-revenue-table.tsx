import { Money01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
}

export function CoursesRevenueTable({
  data,
}: CoursesRevenueTableProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table className="min-w-[520px]">
          <TableCaption className="sr-only">
            Receita agregada por curso
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Curso</TableHead>
              <TableHead className="whitespace-nowrap text-right" scope="col">
                Pagos / registrados
              </TableHead>
              <TableHead className="whitespace-nowrap text-right" scope="col">
                Receita bruta paga
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((course) => (
                <TableRow key={course.courseId}>
                  <TableRowHeader className="font-semibold">
                    {course.courseTitle}
                  </TableRowHeader>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {course.paidOrders} de {course.totalOrders}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatCurrencyInCents(course.totalRevenueInCents)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-48 p-0" colSpan={3}>
                  <Empty className="rounded-none border-0 border-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon aria-hidden="true" icon={Money01Icon} />
                      </EmptyMedia>
                      <EmptyTitle as="h3">
                        Nenhum faturamento registrado
                      </EmptyTitle>
                      <EmptyDescription>
                        Ainda não há vendas de cursos processadas no histórico.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
