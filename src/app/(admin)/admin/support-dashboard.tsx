import {
  BookOpen01Icon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
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
import { getCourseDeliveryStatusPresentation } from "@/features/admin/status-presentation";
import type { SupportCourseOperation } from "@/features/admin/support-server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export function SupportDashboard({
  courses,
}: {
  courses: SupportCourseOperation[];
}): React.JSX.Element {
  const totalEnrollments = courses.reduce(
    (sum, course) => sum + course.totalEnrollmentCount,
    0
  );
  const paidOrders = courses.reduce(
    (sum, course) => sum + course.paidOrderCount,
    0
  );
  const paidRevenueInCents = courses.reduce(
    (sum, course) => sum + course.paidRevenueInCents,
    0
  );

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
            value={courses.length.toString()}
          />
          <AdminMetricCard
            helper="Soma das matrículas em todos os Cursos."
            icon={UserGroupIcon}
            label="Matrículas"
            value={totalEnrollments.toString()}
          />
          <AdminMetricCard
            helper="Pedidos atualmente confirmados como pagos."
            icon={Invoice01Icon}
            label="Pedidos pagos"
            value={paidOrders.toString()}
          />
          <AdminMetricCard
            helper="Receita dos Pedidos atualmente pagos."
            icon={Invoice01Icon}
            label="Receita paga"
            value={formatCurrencyInCents(paidRevenueInCents)}
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
            {courses.length ? (
              courses.map((course) => (
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
              <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                Nenhum Curso disponível para consulta.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function CourseStatusBadge({ status }: { status: string }): React.JSX.Element {
  const presentation = getCourseDeliveryStatusPresentation(status);

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
