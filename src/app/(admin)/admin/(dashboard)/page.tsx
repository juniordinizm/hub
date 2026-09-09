import {
  Book01Icon,
  BookOpen01Icon,
  Certificate01Icon,
  Invoice01Icon,
  ShoppingCart01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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
import { Progress } from "@/components/ui/progress";

import {
  type AdminOperationSignal,
  getAdminOperationSignal,
  summarizeAdminCourseHealth,
} from "@/features/admin/presentation";
import {
  getAdminDashboardProjection,
  getAdminOverview,
} from "@/features/admin/server";
import { getOrderStatusPresentation } from "@/features/admin/status-presentation";
import { getSupportCourseOperations } from "@/features/admin/support-server";
import { requirePermission } from "@/lib/auth-permissions";
import {
  formatCurrencyInCents,
  formatDate,
  formatDateTime,
} from "@/lib/formatters";
import { route } from "@/lib/routes";
import { AdminMetricCard } from "../admin-metric-card";
import { SupportDashboard } from "../support-dashboard";

export const dynamic = "force-dynamic";

const getOperationSignalBadgeVariant = (
  tone: AdminOperationSignal["tone"]
): "destructive" | "success" | "warning" => {
  if (tone === "attention") {
    return "destructive";
  }
  if (tone === "watch") {
    return "warning";
  }
  return "success";
};

const metrics = [
  {
    label: "Cursos",
    key: "courses",
    icon: BookOpen01Icon,
    helper: "Cursos cadastrados",
  },
  {
    label: "Alunas",
    key: "students",
    icon: UserGroupIcon,
    helper: "Perfis cadastrados",
  },
  {
    label: "Acessos",
    key: "activeEnrollments",
    icon: UserCircleIcon,
    helper: "Matrículas vigentes",
  },
  {
    label: "Pedidos",
    key: "paidOrders",
    icon: ShoppingCart01Icon,
    helper: "Vendas confirmadas",
  },
] as const;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("viewAdminPanel");

  if (session.role === "support") {
    const courses = await getSupportCourseOperations();
    return <SupportDashboard courses={courses} />;
  }

  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminDashboardProjection(),
  ]);
  const courseHealth = summarizeAdminCourseHealth(
    data.courses.map((course) => ({
      hasDescription: Boolean(course.description?.trim()),
      hasThumbnail: Boolean(course.thumbnailUrl),
      id: course.id,
      moduleCount: course.moduleCount,
      publishedLessonCount: course.publishedLessonCount,
      status: course.status,
      title: course.title,
      totalLessonCount: course.totalLessonCount,
    }))
  );
  const operationSignal = getAdminOperationSignal({
    coursesNeedingAttention: courseHealth.coursesNeedingAttention.length,
    failedWebhooks: overview.failedWebhooks,
    pendingOrders: overview.pendingOrders,
    retryableWebhooks: overview.retryableWebhooks,
  });

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={route("/admin/cursos")}>
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                    icon={Book01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Revisar catálogo
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={route("/admin/financeiro")}>
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                    icon={Invoice01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Ver financeiro
                </Link>
              </Button>
            </>
          }
          description="Acompanhe catálogo, acessos e pagamentos em uma visão feita para operar seus cursos com alto controle."
          title="Central do LMS"
        />

        <section className="order-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <AdminMetricCard
              helper={metric.helper}
              icon={metric.icon}
              key={metric.key}
              label={metric.label}
              value={overview[metric.key].toString()}
            />
          ))}
        </section>

        <section className="order-1 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle as="h2" className="text-base">
                    Saúde da operação
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Sinal rápido do que pode bloquear vendas ou liberação de
                    acesso.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getOperationSignalBadgeVariant(
                      operationSignal.tone
                    )}
                  >
                    {operationSignal.label}
                  </Badge>
                  {operationSignal.actionHref ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={route(operationSignal.actionHref)}>
                        Abrir
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
                <AdminSignalTile
                  label="Receita paga"
                  value={formatCurrencyInCents(overview.paidRevenueInCents)}
                />
                <AdminSignalTile
                  label="Pedidos pendentes"
                  value={overview.pendingOrders.toString()}
                />
                <AdminSignalTile
                  label="Webhooks a verificar"
                  value={(
                    overview.failedWebhooks + overview.retryableWebhooks
                  ).toString()}
                />
              </div>
              <div className="border-t bg-muted/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">Prontidão do catálogo</p>
                  <span className="font-semibold text-sm">
                    {courseHealth.averageReadinessPercent}%
                  </span>
                </div>
                <Progress
                  aria-label={`Prontidão média do catálogo: ${courseHealth.averageReadinessPercent}%`}
                  className="mt-3 h-2"
                  value={courseHealth.averageReadinessPercent}
                />
                <div className="mt-3 flex gap-6 text-sm">
                  <InfoRow
                    label="Ativos:"
                    value={courseHealth.activeCourses.toString()}
                  />
                  <InfoRow
                    label="Rascunhos:"
                    value={courseHealth.draftCourses.toString()}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Catálogo pendente
              </CardTitle>
              <CardDescription className="mt-1">
                Abra diretamente a área que precisa de ajuste.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {courseHealth.coursesNeedingAttention.length ? (
                courseHealth.coursesNeedingAttention.map((course) => (
                  <Link
                    className="rounded-lg border bg-muted/10 p-3 transition-colors hover:bg-muted/40"
                    href={route(
                      `/admin/cursos/${course.id}?tab=${course.actionTab}`
                    )}
                    key={course.id}
                  >
                    <p className="font-medium text-sm">{course.title}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Abrir{" "}
                      {course.actionTab === "content"
                        ? "conteúdo"
                        : "configurações"}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum Curso pendente.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="order-3 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle as="h2" className="text-base">
                Últimas compras
              </CardTitle>
              <CardDescription className="mt-1">
                Movimentações mais recentes do checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.recentOrders.length ? (
                data.recentOrders.map((order) => {
                  const status = getOrderStatusPresentation(order.status);

                  return (
                    <Link
                      className="flex flex-col justify-between border-b py-3 transition-colors last:border-b-0 hover:bg-muted/20"
                      href={route(
                        `/admin/financeiro?tab=orders&q=${encodeURIComponent(order.id)}`
                      )}
                      key={order.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium text-sm">
                          {order.customerName ?? order.customerEmail ?? "Aluna"}
                        </p>
                        <Badge className="shrink-0" variant={status.variant}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-muted-foreground text-xs">
                            {order.courseTitle}
                          </p>
                          <p className="mt-1 text-muted-foreground text-xs">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <p className="font-semibold text-sm">
                          {formatCurrencyInCents(order.amountInCents)}
                        </p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhuma compra registrada ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle as="h2" className="font-medium text-base">
                  Últimos certificados emitidos
                </CardTitle>
              </div>
              <CardDescription className="mt-1">
                Emissões mais recentes da plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.recentCertificates.length ? (
                data.recentCertificates.map((certificate) => (
                  <Link
                    className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    href={route(`/certificados/${certificate.code}`)}
                    key={certificate.code}
                  >
                    <span className="block font-medium text-sm">
                      {certificate.studentName}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">
                      {certificate.courseTitle}
                    </span>
                    <span className="mt-2 block font-mono text-muted-foreground text-xs">
                      {certificate.code} · {formatDate(certificate.issuedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum certificado emitido ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}

function AdminSignalTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col justify-center p-5">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <p className="mt-1.5 font-bold text-2xl tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
