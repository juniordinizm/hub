import {
  Analytics01Icon,
  Book01Icon,
  Invoice01Icon,
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
  getAdminManagementData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatCurrencyInCents, formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const metrics = [
  ["Cursos publicados", "courses"],
  ["Alunos", "students"],
  ["Acessos ativos", "activeEnrollments"],
  ["Pedidos pagos", "paidOrders"],
] as const;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
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
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Badge variant="outline">Operacao</Badge>
              <h1 className="mt-3 text-balance font-bold text-3xl tracking-tight">
                Central do LMS
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
                Acompanhe catalogo, acessos e pagamentos em uma visao feita para
                operar poucos cursos privados com alto controle.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={route("/admin/cursos")}>
                  <HugeiconsIcon icon={Book01Icon} size={16} strokeWidth={2} />
                  Revisar catalogo
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={route("/admin/financeiro")}>
                  <HugeiconsIcon
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

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, key]) => (
            <Card
              className="border-border/40 bg-background/50 shadow-sm"
              key={key}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-muted-foreground text-sm">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-bold text-4xl tracking-tight">
                  {overview[key]}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <Card className="overflow-hidden border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b bg-muted/25">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Saude da operacao</CardTitle>
                  <CardDescription>
                    Sinal rapido do que pode bloquear venda ou liberacao de
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
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-muted-foreground text-sm">
                  {operationSignal.helper}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
              </div>
              <div className="rounded-lg border bg-background/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">Prontidao do catalogo</p>
                  <span className="font-semibold text-sm">
                    {courseHealth.averageReadinessPercent}%
                  </span>
                </div>
                <Progress
                  className="mt-3 h-2"
                  value={courseHealth.averageReadinessPercent}
                />
                <div className="mt-4 grid gap-2 text-sm">
                  <InfoRow
                    label="Cursos ativos"
                    value={courseHealth.activeCourses.toString()}
                  />
                  <InfoRow
                    label="Rascunhos"
                    value={courseHealth.draftCourses.toString()}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Proximas acoes</CardTitle>
              <CardDescription>
                Atalhos para as rotinas que mais impactam a experiencia do
                aluno.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <AdminActionLink
                description="Completar capas, aulas publicadas e checkout."
                href="/admin/cursos"
                icon={Book01Icon}
                label="Ajustar catalogo"
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

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="border-border/40 bg-background/50 shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle>Cursos que precisam de atencao</CardTitle>
              <CardDescription>
                Priorizados pelos itens que ainda faltam para venda e consumo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {courseHealth.coursesNeedingAttention.length ? (
                courseHealth.coursesNeedingAttention.map((course) => (
                  <div
                    className="rounded-lg border bg-card/60 p-4"
                    key={course.title}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{course.title}</p>
                        <p className="text-muted-foreground text-sm">
                          {course.missingCount} item
                          {course.missingCount === 1 ? "" : "s"} pendente
                          {course.missingCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="font-semibold text-sm">
                        {course.readinessPercent}%
                      </span>
                    </div>
                    <Progress
                      className="mt-3 h-2"
                      value={course.readinessPercent}
                    />
                  </div>
                ))
              ) : (
                <p className="rounded-lg border bg-card/60 p-4 text-muted-foreground text-sm">
                  Todos os cursos cadastrados passaram pelo checklist minimo.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle>Pedidos recentes</CardTitle>
              <CardDescription>
                Ultimas movimentacoes do checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recentOrders.length ? (
                recentOrders.map((order) => (
                  <div className="rounded-lg border p-3" key={order.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-sm">
                        {order.customerName ?? order.customerEmail ?? "Aluno"}
                      </p>
                      <Badge variant="outline">{order.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-xs">
                      {order.courseTitle}
                    </p>
                    <p className="mt-2 font-medium text-sm">
                      {formatCurrencyInCents(order.amountInCents)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum pedido registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8">
          <Card className="border-border/40 bg-background/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={Analytics01Icon}
                  size={18}
                  strokeWidth={2}
                />
                <CardTitle className="font-semibold text-lg">
                  Webhooks recentes
                </CardTitle>
              </div>
              <CardDescription>
                Ultimos eventos recebidos do provedor de pagamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-0">
              {overview.recentWebhooks.length ? (
                overview.recentWebhooks.map((event, index) => (
                  <div key={event.eventKey}>
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-muted-foreground text-xs">
                          {event.eventKey}
                        </p>
                        <p className="mt-1 font-medium text-foreground text-sm">
                          {event.eventName}
                        </p>
                        {event.errorMessage ? (
                          <p className="mt-1 text-destructive text-xs">
                            {event.errorMessage}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.status}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                    </div>
                    {index < overview.recentWebhooks.length - 1 ? (
                      <Separator />
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum webhook recebido ainda.
                </p>
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
  icon: typeof Book01Icon;
  label: string;
}): React.JSX.Element {
  return (
    <Button
      asChild
      className="h-auto justify-start gap-3 px-3 py-3 text-left"
      variant="outline"
    >
      <Link href={route(href)}>
        <HugeiconsIcon icon={icon} size={18} strokeWidth={2} />
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span className="block text-muted-foreground text-xs">
            {description}
          </span>
        </span>
      </Link>
    </Button>
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
    <div className="rounded-lg border bg-background/45 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-xl tracking-tight">{value}</p>
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
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
