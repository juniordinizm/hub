import {
  ArrowRight01Icon,
  Certificate01Icon,
  Money01Icon,
  ShoppingCart01Icon,
  Time02Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FinanceHelp } from "@/components/admin/finance-help";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Progress } from "@/components/ui/progress";
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
import type {
  AdminDashboardCourseHealth,
  AdminDashboardCourseHealthProjection,
  AdminDashboardOperations,
  AdminDashboardPendingCertificate,
  AdminDashboardRecentCertificate,
  AdminDashboardRecentOrder,
  AdminDashboardSupportDeliveryState,
  AdminDashboardSupportRequest,
  AdminOverview,
} from "@/features/admin/server";
import {
  getAdminDashboardProjection,
  getAdminOverview,
} from "@/features/admin/server";
import {
  getCertificateStatusPresentation,
  getCheckoutStatusPresentation,
  getOrderStatusPresentation,
} from "@/features/admin/status-presentation";
import { getSupportCourseOperations } from "@/features/admin/support-server";
import { requirePermission } from "@/lib/auth-permissions";
import {
  formatCurrencyInCents,
  formatDate,
  formatDateTime,
} from "@/lib/formatters";
import { route } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AdminMetricCard } from "../admin-metric-card";
import { SupportDashboard } from "../support-dashboard";

export const dynamic = "force-dynamic";

type DashboardIssueTone = "attention" | "watch";

interface DashboardIssue {
  actionLabel: string;
  count: number;
  description: string;
  href: string;
  label: string;
  tone: DashboardIssueTone;
}

const countFormatter = new Intl.NumberFormat("pt-BR");

const formatCount = (value: number): string => countFormatter.format(value);

const formatCountBreakdown = (
  parts: readonly (readonly [string, number])[]
): string =>
  parts
    .map(([label, value]) => [label, formatCount(value)].join(": "))
    .join(" · ");

const getPluralLabel = (
  value: number,
  singular: string,
  plural: string
): string => (value === 1 ? singular : plural);

const getIssueGroupBadgeVariant = (
  itemCount: number,
  tone: DashboardIssueTone
): "destructive" | "outline" | "warning" => {
  if (itemCount === 0) {
    return "outline";
  }
  return tone === "attention" ? "destructive" : "warning";
};

const getSupportDeliveryPresentation = (
  state: AdminDashboardSupportDeliveryState
): {
  label: string;
  variant: "destructive" | "info" | "success" | "warning";
} => {
  switch (state) {
    case "delayed":
      return { label: "Atrasado", variant: "warning" };
    case "delivered":
      return { label: "Entregue", variant: "success" };
    case "failed":
      return { label: "Falhou", variant: "destructive" };
    case "sending":
      return { label: "Enviando", variant: "info" };
    case "sent":
      return { label: "Aceito pelo provedor", variant: "info" };
    default:
      return { label: "Na fila", variant: "warning" };
  }
};

const getCourseMissingItems = (
  course: AdminDashboardCourseHealth
): string[] => {
  const missing: string[] = [];

  if (!course.hasDescription) {
    missing.push("descrição");
  }
  if (!course.hasThumbnail) {
    missing.push("capa");
  }
  if (course.moduleCount === 0) {
    missing.push("módulos");
  }
  if (course.totalLessonCount === 0) {
    missing.push("aulas");
  } else if (course.publishedLessonCount === 0) {
    missing.push("aulas publicadas");
  } else if (course.publishedLessonCount < course.totalLessonCount) {
    missing.push("publicação das aulas");
  }
  if (!course.hasPublishedPublication) {
    missing.push("publicação vigente");
  }

  return missing;
};

const getDashboardIssues = ({
  courseHealth,
  operations,
  overview,
}: {
  courseHealth: AdminDashboardCourseHealthProjection;
  operations: AdminDashboardOperations;
  overview: AdminOverview;
}): {
  attention: DashboardIssue[];
  watch: DashboardIssue[];
} => {
  const attention: DashboardIssue[] = [];
  const watch: DashboardIssue[] = [];
  const add = (target: DashboardIssue[], issue: DashboardIssue): void => {
    if (issue.count > 0) {
      target.push(issue);
    }
  };
  const backlog = operations.integrations.backlog;
  const financial = operations.financial;
  const support = operations.supportRequests;
  const failedIntegrationCount =
    backlog.webhooks.failed + backlog.outbox.deadLetters;
  const uncertainFinancialCount =
    financial.uncertainCheckoutCount +
    financial.uncertainRefundCount +
    financial.uncorrelatedOrderCount;

  add(attention, {
    actionLabel: "Abrir fila",
    count: financial.pendingPaymentReviewCount,
    description:
      "Exceções aguardam uma decisão antes de concluir o fluxo financeiro.",
    href: "/admin/financeiro",
    label: "Revisões financeiras",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Ver financeiro",
    count: uncertainFinancialCount,
    description: formatCountBreakdown([
      ["Checkouts incertos", financial.uncertainCheckoutCount],
      ["Sem pagamento vinculado", financial.uncorrelatedOrderCount],
      ["Reembolsos incertos", financial.uncertainRefundCount],
    ]),
    href: "/admin/financeiro",
    label: "Resultados financeiros incertos",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Ver reembolsos",
    count: operations.financial.failedRefundCount,
    description:
      "O reembolso falhou e precisa ser conferido antes de uma nova tentativa.",
    href: "/admin/financeiro",
    label: "Reembolsos com falha",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Abrir Auditoria",
    count: failedIntegrationCount,
    description: formatCountBreakdown([
      ["Webhooks falhos", backlog.webhooks.failed],
      ["Mensagens em dead letter", backlog.outbox.deadLetters],
    ]),
    href: "/admin/auditoria",
    label: "Falhas de integração",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Ver certificados",
    count: operations.certificates.pendingCount,
    description: "Há conclusões elegíveis sem certificado emitido no Hub.",
    href: "/admin/cursos",
    label: "Certificados pendentes",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Ver configurações",
    count:
      operations.integrations.failedJmvUploadCount +
      operations.integrations.failedJmvDeleteCount,
    description: formatCountBreakdown([
      ["Uploads falhos", operations.integrations.failedJmvUploadCount],
      ["Exclusões falhas", operations.integrations.failedJmvDeleteCount],
    ]),
    href: "/admin/configuracoes",
    label: "Falhas de vídeo",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Abrir Auditoria",
    count: backlog.emailDelivery.deadLetters,
    description:
      "Eventos de entrega de e-mail não atualizaram o estado local e exigem investigação.",
    href: "/admin/auditoria",
    label: "Eventos de e-mail em dead letter",
    tone: "attention",
  });
  add(attention, {
    actionLabel: "Abrir Auditoria",
    count: support.failedCount,
    description:
      "Solicitações de suporte não foram entregues ao fluxo de e-mail.",
    href: "/admin/auditoria",
    label: "E-mails de suporte com falha",
    tone: "attention",
  });

  add(watch, {
    actionLabel: "Ver pedidos",
    count: overview.pendingOrders,
    description: "Checkouts ainda abertos; não entram na receita bruta paga.",
    href: "/admin/financeiro?tab=orders&status=pending&checkout=open",
    label: "Pedidos aguardando confirmação",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Abrir Auditoria",
    count: backlog.webhooks.retryable,
    description:
      "A próxima tentativa automática ainda pode regularizar estes eventos.",
    href: "/admin/auditoria",
    label: "Webhooks em retry",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Ver financeiro",
    count: operations.financial.pendingRefundCount,
    description: "Solicitações de reembolso ainda estão em processamento.",
    href: "/admin/financeiro",
    label: "Reembolsos em processamento",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Ver disputas",
    count: operations.financial.disputedOrderCount,
    description:
      "Pedidos permanecem marcados como disputa no estado financeiro local.",
    href: "/admin/financeiro?tab=orders&status=disputed",
    label: "Pedidos em disputa",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Ver alunos",
    count: operations.access.expiringStudentCount,
    description:
      "Alunos têm pelo menos um acesso efetivo que vence nos próximos 30 dias.",
    href: "/admin/alunos",
    label: "Acessos vencendo em 30 dias",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Revisar catálogo",
    count: courseHealth.coursesNeedingAttentionCount,
    description:
      "Cursos ainda não cumprem todos os critérios mínimos de publicação.",
    href: "/admin/cursos",
    label: "Cursos a revisar",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Revisar catálogo",
    count: courseHealth.salesPausedCourses,
    description:
      "Cursos ativos preservam os acessos atuais, mas não aceitam novas compras.",
    href: "/admin/cursos",
    label: "Vendas pausadas",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Ver configurações",
    count:
      operations.integrations.processingJmvUploadCount +
      operations.integrations.pendingJmvDeleteCount,
    description: formatCountBreakdown([
      [
        "Uploads em processamento",
        operations.integrations.processingJmvUploadCount,
      ],
      ["Exclusões aguardando", operations.integrations.pendingJmvDeleteCount],
    ]),
    href: "/admin/configuracoes",
    label: "Vídeos em processamento",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Abrir Auditoria",
    count: backlog.emailDelivery.retrying,
    description:
      "Eventos de entrega aguardam nova tentativa ou correlação do provedor.",
    href: "/admin/auditoria",
    label: "Eventos de e-mail em retry",
    tone: "watch",
  });
  add(watch, {
    actionLabel: "Abrir Auditoria",
    count: support.pendingCount,
    description:
      "Solicitações foram registradas, mas o e-mail ainda não foi entregue.",
    href: "/admin/auditoria",
    label: "Solicitações aguardando e-mail",
    tone: "watch",
  });

  return { attention, watch };
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}): Promise<React.JSX.Element> {
  const session = await requirePermission("viewAdminPanel");

  if (session.role === "support") {
    const params = (await searchParams) ?? {};
    const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
    const requestedPage = Number.parseInt(rawPage ?? "1", 10);
    const courseOperations = await getSupportCourseOperations({
      page: Number.isFinite(requestedPage) ? requestedPage : 1,
    });
    return <SupportDashboard data={courseOperations} />;
  }

  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminDashboardProjection(),
  ]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          description="Resolva o que pode afetar acesso, vendas ou publicação."
          title="Operação diária"
        />

        <DashboardSummary operations={data.operations} overview={overview} />

        <OperationsOverview
          courseHealth={data.courseHealth}
          operations={data.operations}
          overview={overview}
        />

        <OperationalContext operations={data.operations} />

        <RecentActivity
          recentCertificates={data.recentCertificates}
          recentOrders={data.recentOrders}
        />

        {data.operations.supportRequests.totalCount > 0 ? (
          <SupportRequestsSection
            recent={data.operations.supportRequests.recent}
            totalCount={data.operations.supportRequests.totalCount}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

function DashboardSummary({
  operations,
  overview,
}: {
  operations: AdminDashboardOperations;
  overview: AdminOverview;
}): React.JSX.Element {
  const metrics: Array<{
    help?: ReactNode;
    helper: string;
    icon: unknown;
    label: string;
    value: string;
  }> = [
    {
      helper: "Histórico; não é saldo no Asaas",
      help: (
        <FinanceHelp
          description="A receita é calculada a partir dos pedidos que o Hub mantém como pagos."
          details={[
            "É um histórico operacional do Hub; não representa saldo disponível ou liquidação no Asaas.",
            "Pedidos em aberto aparecem separadamente no contexto financeiro.",
          ]}
          title="Receita bruta paga"
        />
      ),
      icon: Money01Icon,
      label: "Receita bruta paga",
      value: formatCurrencyInCents(overview.paidRevenueInCents),
    },
    {
      helper: "Perfis de estudante",
      icon: UserGroupIcon,
      label: "Alunos cadastrados",
      value: formatCount(overview.students),
    },
    {
      helper: "Matrículas vigentes",
      icon: UserCircleIcon,
      label: "Acessos ativos",
      value: formatCount(overview.activeEnrollments),
    },
    {
      helper:
        formatCount(operations.access.expiringEnrollmentCount) +
        " " +
        getPluralLabel(
          operations.access.expiringEnrollmentCount,
          "matrícula",
          "matrículas"
        ),
      icon: Time02Icon,
      label: "Vencendo em 30 dias",
      value: formatCount(operations.access.expiringStudentCount),
    },
    {
      helper: "Confirmados no histórico",
      icon: ShoppingCart01Icon,
      label: "Pedidos pagos",
      value: formatCount(overview.paidOrders),
    },
  ];

  return (
    <section aria-labelledby="dashboard-summary-title">
      <div className="mb-3">
        <h2 className="type-section-title" id="dashboard-summary-title">
          Resumo do dia
        </h2>
        <p className="type-body-sm mt-1 text-muted-foreground">
          Os números principais para começar a operação.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <AdminMetricCard
            help={metric.help}
            helper={metric.helper}
            icon={metric.icon}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>
    </section>
  );
}

function OperationsOverview({
  courseHealth,
  operations,
  overview,
}: {
  courseHealth: AdminDashboardCourseHealthProjection;
  operations: AdminDashboardOperations;
  overview: AdminOverview;
}): React.JSX.Element | null {
  const issues = getDashboardIssues({ courseHealth, operations, overview });
  const hasAttention = issues.attention.length > 0;
  const hasWatch = issues.watch.length > 0;
  const hasOperationalQueues = hasAttention || hasWatch;
  const hasCatalog = courseHealth.averageReadinessPercent !== null;
  const hasPendingCertificates = operations.certificates.pendingCount > 0;
  const hasCatalogContent = hasCatalog || hasPendingCertificates;

  if (!(hasOperationalQueues || hasCatalogContent)) {
    return null;
  }

  const attentionSignalCount = issues.attention.length;
  const signalCount = attentionSignalCount + issues.watch.length;
  let operationBadgeLabel = "Operação estável";
  if (signalCount > 0) {
    operationBadgeLabel = "Sem ação imediata";
  }
  if (attentionSignalCount > 0) {
    operationBadgeLabel = `${formatCount(attentionSignalCount)} pontos para agir`;
  }
  const operationBadgeVariant =
    attentionSignalCount > 0 ? "destructive" : "success";

  return (
    <>
      {hasOperationalQueues ? (
        <section aria-labelledby="dashboard-operations-title">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-1">
              <h2
                className="type-section-title"
                id="dashboard-operations-title"
              >
                Pendências para resolver
              </h2>
              <FinanceHelp
                description="Use os grupos para distinguir o que exige uma decisão agora do que pode ser apenas acompanhado."
                details={[
                  "Ação necessária reúne falhas e exceções que podem bloquear acesso, venda ou publicação.",
                  "Acompanhar reúne filas e prazos que ainda não exigem intervenção imediata.",
                ]}
                title="Como ler as pendências"
              />
            </div>
            <Badge className="w-fit" variant={operationBadgeVariant}>
              {operationBadgeLabel}
            </Badge>
          </div>
          <div className="grid gap-4">
            {hasAttention ? (
              <IssueGroup
                description="Falhas e exceções que podem bloquear uma decisão."
                issues={issues.attention}
                title="Ação necessária"
                tone="attention"
              />
            ) : null}
            {hasWatch ? (
              <IssueGroup
                description="Filas, prazos e estados que merecem acompanhamento."
                issues={issues.watch}
                title="Acompanhar"
                tone="watch"
              />
            ) : null}
          </div>
        </section>
      ) : null}
      {hasCatalogContent ? (
        <section aria-labelledby="dashboard-content-title">
          <div className="mb-3">
            <h2 className="type-section-title" id="dashboard-content-title">
              Conteúdo e certificados
            </h2>
            <p className="type-body-sm mt-1 text-muted-foreground">
              Publicação e emissão que ainda precisam de acompanhamento.
            </p>
          </div>
          <div
            className={cn(
              "grid gap-4",
              hasCatalog && hasPendingCertificates && "xl:grid-cols-2"
            )}
          >
            {hasCatalog ? (
              <CatalogHealthCard courseHealth={courseHealth} />
            ) : null}
            {hasPendingCertificates ? (
              <CertificateQueueCard
                pending={operations.certificates.pending}
                pendingCount={operations.certificates.pendingCount}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function IssueGroup({
  description,
  issues,
  title,
  tone,
}: {
  description: string;
  issues: DashboardIssue[];
  title: string;
  tone: DashboardIssueTone;
}): React.JSX.Element {
  const itemCount = issues.reduce((total, issue) => total + issue.count, 0);
  const headingId = `dashboard-issue-${tone}-title`;

  return (
    <Card className="min-w-0">
      <CardHeader className="border-b bg-muted/15 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle as="h3" className="text-base" id={headingId}>
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge
            className="shrink-0 tabular-nums"
            variant={getIssueGroupBadgeVariant(itemCount, tone)}
          >
            {formatCount(itemCount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {issues.map((issue) => (
          <IssueRow issue={issue} key={issue.label} />
        ))}
      </CardContent>
    </Card>
  );
}

function IssueRow({ issue }: { issue: DashboardIssue }): React.JSX.Element {
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{issue.label}</span>
          <Badge
            variant={issue.tone === "attention" ? "destructive" : "warning"}
          >
            {formatCount(issue.count)}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          {issue.description}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={route(issue.href)}>
          {issue.actionLabel}
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-end"
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
          />
        </Link>
      </Button>
    </div>
  );
}

function CatalogHealthCard({
  courseHealth,
}: {
  courseHealth: AdminDashboardCourseHealthProjection;
}): React.JSX.Element | null {
  if (courseHealth.averageReadinessPercent === null) {
    return null;
  }

  const readinessLabel = `${String(courseHealth.averageReadinessPercent)}%`;

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b bg-muted/15 pb-4">
        <div>
          <div className="flex items-center gap-1">
            <CardTitle
              as="h3"
              className="text-base"
              id="dashboard-catalog-title"
            >
              Prontidão do catálogo
            </CardTitle>
            <FinanceHelp
              description="A prontidão resume os requisitos mínimos que deixam um Curso pronto para publicação."
              details={[
                "A análise considera descrição, capa, estrutura, aulas e publicação vigente.",
                "Ela é uma triagem operacional; a disponibilidade comercial ainda depende do estado de vendas do Curso.",
              ]}
              title="Prontidão do catálogo"
            />
          </div>
          <CardDescription className="mt-1">
            Veja o que impede cada Curso de ficar pronto para publicação.
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link href={route("/admin/cursos")}>Abrir catálogo</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="m-4 rounded-lg border bg-muted/10 p-4 sm:m-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Prontidão média</span>
            <strong className="font-semibold tabular-nums">
              {readinessLabel}
            </strong>
          </div>
          <Progress
            aria-label={
              "Prontidão média do catálogo: " +
              String(courseHealth.averageReadinessPercent) +
              "%"
            }
            className="mt-3 h-2"
            value={courseHealth.averageReadinessPercent}
          />
          <p className="mt-2 text-muted-foreground text-xs">
            Base: descrição, capa, estrutura, aulas e publicação vigente.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-muted-foreground">Ativos:</span>{" "}
              <strong className="tabular-nums">
                {courseHealth.activeCourses}
              </strong>
            </span>
            <span>
              <span className="text-muted-foreground">Rascunhos:</span>{" "}
              <strong className="tabular-nums">
                {courseHealth.draftCourses}
              </strong>
            </span>
          </div>
        </div>
        <CoursePriorityList courseHealth={courseHealth} />
      </CardContent>
    </Card>
  );
}

function CoursePriorityList({
  courseHealth,
}: {
  courseHealth: AdminDashboardCourseHealthProjection;
}): React.JSX.Element | null {
  if (
    courseHealth.averageReadinessPercent === null ||
    courseHealth.coursesNeedingAttention.length === 0
  ) {
    return null;
  }

  return (
    <div className="p-4 pt-0 sm:p-5 sm:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="type-label">Cursos que precisam de revisão</p>
        <Badge className="tabular-nums" variant="warning">
          {formatCount(courseHealth.coursesNeedingAttentionCount)}
        </Badge>
      </div>
      <div className="grid gap-3">
        {courseHealth.coursesNeedingAttention.map((course) => {
          const missingItems = getCourseMissingItems(course);
          return (
            <div
              className="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={course.id}
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-sm">
                    {course.title}
                  </span>
                  <Badge
                    className="shrink-0 tabular-nums"
                    variant={
                      course.readinessPercent < 50 ? "destructive" : "warning"
                    }
                  >
                    {course.readinessPercent}%
                  </Badge>
                </div>
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  {missingItems.length > 0
                    ? `Falta: ${missingItems.slice(0, 3).join(", ")}`
                    : "Abrir revisão do curso"}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={route(
                    `/admin/cursos/${course.id}?tab=${course.actionTab}`
                  )}
                >
                  Abrir curso
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-end"
                    icon={ArrowRight01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CertificateQueueCard({
  pending,
  pendingCount,
}: {
  pending: AdminDashboardPendingCertificate[];
  pendingCount: number;
}): React.JSX.Element | null {
  if (pendingCount === 0) {
    return null;
  }

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b bg-muted/15 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <CardTitle as="h3" className="text-base">
                Certificados sem emissão
              </CardTitle>
              <FinanceHelp
                description="São Conclusões que atendem aos critérios do Curso, mas ainda não têm um Certificado emitido no Hub."
                details={[
                  "O cartão considera apenas Cursos com certificado habilitado, modelo publicado e emissor configurado.",
                  "Abra o Curso para revisar a emissão histórica de forma controlada.",
                ]}
                title="Certificados sem emissão"
              />
            </div>
            <CardDescription className="mt-1">
              Conclusões elegíveis aguardando reconciliação.
            </CardDescription>
          </div>
          <Badge
            className="shrink-0 tabular-nums"
            variant={pendingCount > 0 ? "warning" : "success"}
          >
            {formatCount(pendingCount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {pending.length > 0 ? (
          <div className="grid gap-3">
            {pending.map((certificate) => (
              <div
                className="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={
                  certificate.courseId +
                  ":" +
                  certificate.studentName +
                  ":" +
                  certificate.completedAt.toISOString()
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {certificate.studentName}
                  </p>
                  <p className="mt-1 truncate text-muted-foreground text-xs">
                    {certificate.courseTitle}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Concluído em {formatDate(certificate.completedAt)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={route(
                      `/admin/cursos/${certificate.courseId}?tab=certificate`
                    )}
                  >
                    Abrir curso
                    <HugeiconsIcon
                      aria-hidden="true"
                      data-icon="inline-end"
                      icon={ArrowRight01Icon}
                      size={16}
                      strokeWidth={2}
                    />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="rounded-lg border border-dashed p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon aria-hidden="true" icon={Certificate01Icon} />
              </EmptyMedia>
              <EmptyTitle as="h3">Tudo emitido</EmptyTitle>
              <EmptyDescription>
                Nenhuma conclusão elegível está aguardando certificado.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      {pendingCount > pending.length ? (
        <CardFooter className="justify-start border-t pt-4">
          <p className="type-meta text-muted-foreground">
            Mostrando {formatCount(pending.length)} de{" "}
            {formatCount(pendingCount)} conclusões. A reconciliação completa
            fica dentro de cada curso.
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function OperationalContext({
  operations,
}: {
  operations: AdminDashboardOperations;
}): React.JSX.Element {
  const backlog = operations.integrations.backlog;
  const support = operations.supportRequests;
  const webhookCount = backlog.webhooks.failed + backlog.webhooks.retryable;

  return (
    <section aria-labelledby="dashboard-context-title">
      <div className="mb-3">
        <h2 className="type-section-title" id="dashboard-context-title">
          Contexto de acompanhamento
        </h2>
        <p className="type-body-sm mt-1 text-muted-foreground">
          Valores e filas que ajudam a interpretar as pendências.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ContextCard
          help={
            <FinanceHelp
              description="Use estes números para acompanhar o fluxo local; o fechamento e o saldo continuam no Asaas."
              details={[
                "Valor em aberto inclui apenas pedidos pendentes com checkout ainda válido.",
                "Disputas e reembolsos mostram o estado atual registrado pelo Hub.",
              ]}
              title="Contexto financeiro"
            />
          }
          title="Financeiro"
        >
          <ContextMetric
            helper="Pedidos abertos; ainda não recebidos"
            label="Valor em aberto"
            value={formatCurrencyInCents(
              operations.financial.pendingRevenueInCents
            )}
          />
          <ContextMetric
            helper="Estado atual dos pedidos"
            label="Disputas"
            value={formatCount(operations.financial.disputedOrderCount)}
          />
          <ContextMetric
            helper="Histórico de pedidos"
            label="Reembolsados"
            value={formatCount(operations.financial.refundedOrderCount)}
          />
        </ContextCard>
        <ContextCard
          help={
            <FinanceHelp
              description="Estas filas mostram o que o Hub recebeu e ainda precisa processar localmente."
              details={[
                "Webhooks Asaas são eventos recebidos; falhas e retries podem atrasar a atualização do Pedido.",
                "Outbox é a fila interna de mensagens; ela não representa saldo ou pendência financeira do provedor.",
              ]}
              title="Integrações"
            />
          }
          title="Integrações"
        >
          <ContextMetric
            helper="Falhos + em retry"
            label="Webhooks Asaas"
            value={formatCount(webhookCount)}
          />
          <ContextMetric
            helper="Fila local, sem saldo do provedor"
            label="Outbox pendente"
            value={formatCount(backlog.outbox.ready)}
          />
        </ContextCard>
        <ContextCard
          help={
            <FinanceHelp
              description="O estado da solicitação indica até onde o e-mail avançou no fluxo de entrega."
              details={[
                "Aceito significa que o provedor recebeu a mensagem; Entregue confirma a entrega ao destinatário.",
                "Na fila, Atrasado e Falhou pedem acompanhamento no fluxo operacional.",
              ]}
              title="Entrega de suporte"
            />
          }
          title="Suporte por e-mail"
        >
          <ContextMetric
            helper="Solicitações registradas"
            label="Solicitações"
            value={formatCount(support.totalCount)}
          />
          <ContextMetric
            helper="Entregues ao destinatário"
            label="Entregues"
            value={formatCount(support.deliveredCount)}
          />
          <ContextMetric
            helper="Aceitos pelo provedor, sem confirmação final"
            label="Aceitos"
            value={formatCount(support.sentCount)}
          />
          <ContextMetric
            helper="Na fila ou com falha"
            label="Acompanhar"
            value={formatCount(support.pendingCount + support.failedCount)}
          />
        </ContextCard>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        Receita bruta paga é o histórico do Hub. Saldo disponível, liquidação e
        detalhes do provedor devem ser conferidos no Asaas.
      </p>
    </section>
  );
}

function ContextCard({
  children,
  className,
  help,
  title,
}: {
  children: ReactNode;
  className?: string;
  help?: ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-1">
          <CardTitle as="h3" className="text-base">
            {title}
          </CardTitle>
          {help}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">{children}</dl>
      </CardContent>
    </Card>
  );
}

function ContextMetric({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
      <div className="min-w-0">
        <dt className="truncate font-medium text-sm">{label}</dt>
        <dd className="mt-1 truncate text-muted-foreground text-xs">
          {helper}
        </dd>
      </div>
      <dd className="shrink-0 text-right font-semibold text-lg tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function RecentActivity({
  recentCertificates,
  recentOrders,
}: {
  recentCertificates: AdminDashboardRecentCertificate[];
  recentOrders: AdminDashboardRecentOrder[];
}): React.JSX.Element | null {
  if (recentCertificates.length === 0 && recentOrders.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-activity-title">
      <div className="mb-3">
        <h2 className="type-section-title" id="dashboard-activity-title">
          Atividade recente
        </h2>
        <p className="type-body-sm mt-1 text-muted-foreground">
          Consulte as compras e emissões mais recentes sem sair do fluxo.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {recentOrders.length > 0 ? (
          <RecentOrdersCard orders={recentOrders} />
        ) : null}
        {recentCertificates.length > 0 ? (
          <RecentCertificatesCard certificates={recentCertificates} />
        ) : null}
      </div>
    </section>
  );
}

function RecentOrdersCard({
  orders,
}: {
  orders: AdminDashboardRecentOrder[];
}): React.JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle as="h3" className="text-base">
            Últimas compras
          </CardTitle>
          <CardDescription className="mt-1">
            Os 5 pedidos mais recentes do checkout.
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link href={route("/admin/financeiro?tab=orders")}>
              Ver todos os pedidos
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-end"
                icon={ArrowRight01Icon}
                size={16}
                strokeWidth={2}
              />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <RecentOrdersTable orders={orders} />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentCertificatesCard({
  certificates,
}: {
  certificates: AdminDashboardRecentCertificate[];
}): React.JSX.Element {
  return (
    <Card className="min-w-0">
      <CardHeader className="border-b pb-4">
        <CardTitle as="h3" className="text-base">
          Últimos certificados emitidos
        </CardTitle>
        <CardDescription className="mt-1">
          Os 5 certificados emitidos mais recentemente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <RecentCertificatesTable certificates={certificates} />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentOrdersTable({
  orders,
}: {
  orders: AdminDashboardRecentOrder[];
}): React.JSX.Element {
  return (
    <Table className="min-w-[760px]">
      <TableCaption className="sr-only">
        Últimos pedidos registrados no checkout
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Compradora</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="whitespace-nowrap">Registrado em</TableHead>
          <TableHead className="text-right">Detalhes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length > 0 ? (
          orders.map((order) => {
            const status = getOrderStatusPresentation(order.status);
            const checkoutStatus = getCheckoutStatusPresentation(
              order.checkoutStatus
            );
            return (
              <TableRow key={order.id}>
                <TableRowHeader className="max-w-[220px]">
                  <span className="block truncate">
                    {order.customerName ?? "Compradora não identificada"}
                  </span>
                  {order.customerEmail ? (
                    <span className="mt-0.5 block truncate font-normal text-muted-foreground text-xs">
                      {order.customerEmail}
                    </span>
                  ) : null}
                </TableRowHeader>
                <TableCell className="max-w-[240px]">
                  <span className="block truncate">{order.courseTitle}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {order.status === "pending" ? (
                    <span className="mt-1 block text-muted-foreground text-xs">
                      Checkout: {checkoutStatus.label}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <span className="block whitespace-nowrap font-medium tabular-nums">
                    {formatCurrencyInCents(
                      order.paidAmountInCents ?? order.amountInCents
                    )}
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-muted-foreground text-xs">
                    {order.paidAmountInCents === null
                      ? "Valor do pedido"
                      : "Valor pago"}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(order.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      aria-label={
                        "Abrir detalhes do pedido de " +
                        (order.customerName ?? "compradora não identificada")
                      }
                      href={route(`/admin/financeiro?tab=orders&q=${order.id}`)}
                    >
                      Detalhes
                      <HugeiconsIcon
                        aria-hidden="true"
                        data-icon="inline-end"
                        icon={ArrowRight01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell className="h-40 p-0" colSpan={6}>
              <Empty className="rounded-none border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={ShoppingCart01Icon}
                    />
                  </EmptyMedia>
                  <EmptyTitle as="h3">Nenhuma compra recente</EmptyTitle>
                  <EmptyDescription>
                    Ainda não há pedidos registrados no checkout.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function RecentCertificatesTable({
  certificates,
}: {
  certificates: AdminDashboardRecentCertificate[];
}): React.JSX.Element {
  return (
    <Table className="min-w-[760px]">
      <TableCaption className="sr-only">
        Últimos certificados emitidos na plataforma
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="whitespace-nowrap">Emitido em</TableHead>
          <TableHead className="text-right">Detalhes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {certificates.length > 0 ? (
          certificates.map((certificate) => {
            const certificateStatus = getCertificateStatusPresentation(
              certificate.status
            );
            return (
              <TableRow key={certificate.code}>
                <TableRowHeader className="max-w-[200px]">
                  <span className="block truncate">
                    {certificate.studentName}
                  </span>
                </TableRowHeader>
                <TableCell className="max-w-[240px]">
                  <span className="block truncate">
                    {certificate.courseTitle}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className="type-code break-all text-muted-foreground"
                    translate="no"
                  >
                    {certificate.code}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={certificateStatus.variant}>
                    {certificateStatus.label}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(certificate.issuedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={route(`/certificados/${certificate.code}`)}>
                      Validar
                      <HugeiconsIcon
                        aria-hidden="true"
                        data-icon="inline-end"
                        icon={ArrowRight01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell className="h-40 p-0" colSpan={6}>
              <Empty className="rounded-none border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={Certificate01Icon}
                    />
                  </EmptyMedia>
                  <EmptyTitle as="h3">Nenhum certificado emitido</EmptyTitle>
                  <EmptyDescription>
                    As emissões recentes aparecerão aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function SupportRequestsSection({
  recent,
  totalCount,
}: {
  recent: AdminDashboardSupportRequest[];
  totalCount: number;
}): React.JSX.Element {
  return (
    <section aria-labelledby="dashboard-support-title">
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle
              as="h2"
              className="text-base"
              id="dashboard-support-title"
            >
              Solicitações de suporte
            </CardTitle>
            <Badge variant="info">{formatCount(totalCount)}</Badge>
          </div>
          <CardDescription className="mt-1">
            Mostrando {formatCount(recent.length)} de {formatCount(totalCount)}
            solicitações mais recentes; o estado indica se o e-mail foi colocado
            na fila, aceito ou entregue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <SupportRequestsTable recent={recent} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SupportRequestsTable({
  recent,
}: {
  recent: AdminDashboardSupportRequest[];
}): React.JSX.Element {
  return (
    <Table className="min-w-[760px]">
      <TableCaption className="sr-only">
        Solicitações de suporte e estado de entrega do e-mail
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Solicitação</TableHead>
          <TableHead>Solicitante</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Envio</TableHead>
          <TableHead className="whitespace-nowrap">Registrada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recent.length > 0 ? (
          recent.map((request) => {
            const delivery = getSupportDeliveryPresentation(
              request.deliveryState
            );
            return (
              <TableRow key={request.id}>
                <TableRowHeader className="max-w-[280px]">
                  <span className="block truncate">{request.subject}</span>
                </TableRowHeader>
                <TableCell>{request.studentName}</TableCell>
                <TableCell className="max-w-[220px]">
                  <span className="block truncate">
                    {request.courseTitle ?? "Geral"}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={delivery.variant}>{delivery.label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(request.createdAt)}
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell className="h-32 p-0" colSpan={5}>
              <Empty className="rounded-none border-0">
                <EmptyHeader>
                  <EmptyTitle as="h3">Nenhuma solicitação recente</EmptyTitle>
                  <EmptyDescription>
                    Os registros de suporte aparecerão aqui quando houver uma
                    solicitação disponível para acompanhar.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
