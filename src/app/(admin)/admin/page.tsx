import {
  Analytics01Icon,
  Book01Icon,
  BookOpen01Icon,
  Invoice01Icon,
  ShoppingCart01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
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
import { Separator } from "@/components/ui/separator";

import {
  getAdminOperationSignal,
  summarizeAdminCourseHealth,
} from "@/features/admin/presentation";
import {
  getAdminDashboardData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { AdminMetricCard } from "./admin-metric-card";

export const dynamic = "force-dynamic";

const metrics = [
  {
    label: "Cursos",
    key: "courses",
    icon: BookOpen01Icon,
    helper: "Publicados e prontos",
  },
  {
    label: "Alunos",
    key: "students",
    icon: UserGroupIcon,
    helper: "Cadastros ativos",
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
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminDashboardData(),
  ]);
  const courseHealth = summarizeAdminCourseHealth(
    data.courses.map((course) => {
      const courseModules = data.modules.filter(
        (moduleData) => moduleData.courseId === course.id
      );
      const courseLessons = data.lessons.filter((lesson) =>
        courseModules.some((moduleData) => moduleData.id === lesson.moduleId)
      );

      return {
        hasDescription: Boolean(course.description?.trim()),
        hasPaymentProviderProductId: Boolean(course.paymentProviderProductId),
        hasThumbnail: Boolean(course.thumbnailUrl),
        moduleCount: courseModules.length,
        publishedLessonCount: courseLessons.filter(
          (lesson) => lesson.isPublished
        ).length,
        status: course.status,
        title: course.title,
        totalLessonCount: courseLessons.length,
      };
    })
  );
  const failedWebhooks = overview.recentWebhooks.filter(
    (webhook) => webhook.status === "failed"
  ).length;
  const pendingOrders = data.orders.filter(
    (order) => order.status === "pending"
  ).length;
  const paidRevenueInCents = data.coursesRevenue.reduce(
    (sum, course) => sum + course.totalRevenueInCents,
    0
  );
  const operationSignal = getAdminOperationSignal({
    coursesNeedingAttention: courseHealth.coursesNeedingAttention.length,
    failedWebhooks,
    pendingOrders,
  });
  const recentOrders = data.orders.slice(0, 4);

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Central do LMS
              </h1>
              <p className="text-muted-foreground text-sm">
                Acompanhe catálogo, acessos e pagamentos em uma visão feita para
                operar seus cursos com alto controle.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button asChild size="sm" variant="outline">
                <Link href={route("/admin/cursos")}>
                  <HugeiconsIcon
                    className="mr-2"
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
                    className="mr-2"
                    icon={Invoice01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  Ver financeiro
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Saúde da operação</CardTitle>
                  <CardDescription className="mt-1">
                    Sinal rápido do que pode bloquear vendas ou liberação de
                    acesso.
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    operationSignal.tone === "attention"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {operationSignal.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
                <AdminSignalTile
                  label="Receita paga"
                  value={formatCurrencyInCents(paidRevenueInCents)}
                />
                <AdminSignalTile
                  label="Pedidos pendentes"
                  value={pendingOrders.toString()}
                />
                <AdminSignalTile
                  label="Webhooks com falha"
                  value={failedWebhooks.toString()}
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

          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Próximas ações</CardTitle>
              <CardDescription className="mt-1">
                Atalhos para as rotinas que mais impactam a experiência do
                aluno.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <AdminActionLink
                description="Completar capas, aulas publicadas e checkout."
                href="/admin/cursos"
                icon={Book01Icon}
                label="Ajustar catálogo"
              />
              <AdminActionLink
                description="Conferir pedidos, certificados e webhooks."
                href="/admin/financeiro"
                icon={Invoice01Icon}
                label="Conferir financeiro"
              />
              <AdminActionLink
                description="Ver acessos ativos, expirados e sem curso."
                href="/admin/alunos"
                icon={UserGroupIcon}
                label="Revisar alunos"
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50 xl:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                Cursos que precisam de atenção
              </CardTitle>
              <CardDescription className="mt-1">
                Priorizados pelos itens que ainda faltam para venda e consumo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {courseHealth.coursesNeedingAttention.length ? (
                courseHealth.coursesNeedingAttention.map((course) => (
                  <div
                    className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    key={course.title}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{course.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {course.missingCount} item
                        {course.missingCount === 1 ? "" : "s"} pendente
                        {course.missingCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="w-full shrink-0 sm:w-32">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-xs">
                          Progresso
                        </span>
                        <span className="font-medium text-xs">
                          {course.readinessPercent}%
                        </span>
                      </div>
                      <Progress
                        className="h-1.5"
                        value={course.readinessPercent}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Todos os cursos cadastrados passaram pelo checklist mínimo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Pedidos recentes</CardTitle>
              <CardDescription className="mt-1">
                Últimas movimentações do checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {recentOrders.length ? (
                recentOrders.map((order) => (
                  <div
                    className="flex flex-col justify-between rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    key={order.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium text-sm">
                        {order.customerName ?? order.customerEmail ?? "Aluno"}
                      </p>
                      <Badge className="shrink-0" variant="secondary">
                        {order.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="truncate text-muted-foreground text-xs">
                        {order.courseTitle}
                      </p>
                      <p className="font-semibold text-sm">
                        {formatCurrencyInCents(order.amountInCents)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum pedido registrado ainda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          <Card className="border-none bg-card shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={Analytics01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle className="font-medium text-base">
                  Webhooks recentes
                </CardTitle>
              </div>
              <CardDescription className="mt-1">
                Últimos eventos recebidos do provedor de pagamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-0">
              {overview.recentWebhooks.length ? (
                overview.recentWebhooks.map((event, index) => (
                  <div key={event.eventKey}>
                    <div className="flex flex-col gap-2 rounded-md px-2 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">
                          {event.eventName}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
                          {event.eventKey}
                        </p>
                        {event.errorMessage ? (
                          <p className="mt-1 text-destructive text-xs">
                            {event.errorMessage}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="outline">{event.status}</Badge>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                    </div>
                    {index < overview.recentWebhooks.length - 1 ? (
                      <Separator className="my-1 opacity-50" />
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum webhook recebido ainda.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AdminActionLink({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  // biome-ignore lint/suspicious/noExplicitAny: type from hugeicons
  icon: any;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      className="group flex items-start gap-4 rounded-lg border bg-muted/10 p-3 transition-colors hover:bg-muted/40"
      href={route(href)}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <HugeiconsIcon icon={icon} size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
      </div>
    </Link>
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
      <p className="mt-1.5 font-bold text-2xl tracking-tight">{value}</p>
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
