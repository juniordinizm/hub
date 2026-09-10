import {
  BookOpen01Icon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AdminMetricCard } from "@/app/(admin)/admin/admin-metric-card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getCourseDeliveryStatusPresentation } from "@/features/admin/status-presentation";
import type { SupportCourseOperationsPage } from "@/features/admin/support-server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export function SupportDashboard({
  data,
}: {
  data: SupportCourseOperationsPage;
}): React.JSX.Element {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <Button asChild>
              <Link href={route("/admin/financeiro")}>Ver financeiro</Link>
            </Button>
          }
          description="Consulte matrículas, histórico financeiro e Certificados no contexto de cada Curso."
          title="Operação de suporte"
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            helper="Cursos disponíveis para consulta operacional."
            icon={BookOpen01Icon}
            label="Cursos"
            value={data.totalCount.toString()}
          />
          <AdminMetricCard
            helper="Soma das matrículas em todos os Cursos."
            icon={UserGroupIcon}
            label="Matrículas"
            value={data.totals.totalEnrollmentCount.toString()}
          />
          <AdminMetricCard
            helper="Pedidos atualmente confirmados como pagos."
            icon={Invoice01Icon}
            label="Pedidos pagos"
            value={data.totals.paidOrderCount.toString()}
          />
          <AdminMetricCard
            helper="Receita dos Pedidos atualmente pagos."
            icon={Invoice01Icon}
            label="Receita paga"
            value={formatCurrencyInCents(data.totals.paidRevenueInCents)}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Cursos em operação</CardTitle>
            <CardDescription>
              Abra um Curso para consultar somente as Alunas vinculadas a ele.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.courses.length ? (
              data.courses.map((course) => (
                <article
                  className="border-b py-4 last:border-b-0"
                  key={course.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="type-card-title truncate">
                          {course.title}
                        </h3>
                        <CourseStatusBadge status={course.status} />
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {course.activeEnrollmentCount} ativas de{" "}
                        {course.totalEnrollmentCount} matrículas
                      </p>
                    </div>
                    <div className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-6">
                      <p>
                        <span className="text-muted-foreground">Pago:</span>{" "}
                        {formatCurrencyInCents(course.paidRevenueInCents)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Reembolsado:
                        </span>{" "}
                        {formatCurrencyInCents(course.refundedRevenueInCents)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {course.paidOrderCount} Pedidos pagos
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {course.refundedOrderCount} reembolsados
                      </p>
                    </div>
                    <Button asChild variant="outline">
                      <Link
                        href={route(
                          `/admin/operacao/cursos/${course.id}/alunas`
                        )}
                      >
                        Consultar Alunas
                      </Link>
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <Empty className="border-0 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon aria-hidden="true" icon={BookOpen01Icon} />
                  </EmptyMedia>
                  <EmptyTitle as="h3">
                    {data.totalCount > 0
                      ? "Nenhum Curso nesta página"
                      : "Nenhum Curso disponível"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {data.totalCount > 0
                      ? "Volte uma página para continuar a consulta."
                      : "Não há Cursos disponíveis para consulta operacional."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
        {data.page > 1 || data.hasNextPage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span aria-live="polite" className="text-muted-foreground text-sm">
              {getCourseResultSummary({
                courseCount: data.courses.length,
                page: data.page,
                pageSize: data.pageSize,
                totalCount: data.totalCount,
              })}
            </span>
            <nav aria-label="Paginação de Cursos" className="flex gap-2">
              {data.page > 1 ? (
                <Button asChild variant="outline">
                  <Link href={getCoursePageHref(data.page - 1)}>Anterior</Link>
                </Button>
              ) : null}
              {data.hasNextPage ? (
                <Button asChild variant="outline">
                  <Link href={getCoursePageHref(data.page + 1)}>Próxima</Link>
                </Button>
              ) : null}
            </nav>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

const getCoursePageHref = (page: number): string =>
  page > 1 ? `/admin?page=${page}` : "/admin";

const getCourseResultSummary = ({
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
    return "Nenhum Curso";
  }
  if (courseCount === 0) {
    return `Nenhum Curso nesta página · ${totalCount} no total`;
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + courseCount - 1, totalCount);
  return `${firstResult}–${lastResult} de ${totalCount} Curso${totalCount === 1 ? "" : "s"}`;
};

function CourseStatusBadge({ status }: { status: string }): React.JSX.Element {
  const presentation = getCourseDeliveryStatusPresentation(status);

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
