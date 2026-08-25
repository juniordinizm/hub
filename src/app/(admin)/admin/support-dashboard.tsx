import {
  BookOpen01Icon,
  Invoice01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { AdminMetricCard } from "@/app/(admin)/admin/admin-metric-card";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Operação de suporte
              </h1>
              <p className="max-w-2xl text-muted-foreground text-sm">
                Consulte matrículas, histórico financeiro e Certificados no
                contexto de cada Curso.
              </p>
            </div>
            <Button asChild>
              <Link href={route("/admin/financeiro")}>Ver financeiro</Link>
            </Button>
          </div>
        </header>

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

        <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle>Cursos em operação</CardTitle>
            <CardDescription>
              Abra um Curso para consultar somente as Alunas vinculadas a ele.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {courses.length ? (
              courses.map((course) => (
                <article
                  className="rounded-lg bg-muted/20 p-4 shadow-[inset_0_0_0_1px_var(--border)]"
                  key={course.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-base">
                          {course.title}
                        </h2>
                        <Badge variant="secondary">{course.status}</Badge>
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
