import Link from "next/link";
import { RetryWebhookOperation } from "@/components/admin/retry-webhook-operation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  getAdminAuditData,
  getAdminWebhookEvents,
} from "@/features/admin/server";
import { getWebhookStatusPresentation } from "@/features/admin/status-presentation";
import type { OperationalAlert } from "@/features/operations/server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { OutboxDeadLetterReprocess } from "./outbox-dead-letters";

export const dynamic = "force-dynamic";

interface AuditSearchParams {
  outboxPage?: string | string[] | undefined;
  webhookPage?: string | string[] | undefined;
  webhookQ?: string | string[] | undefined;
}

const firstSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const auditPageHref = (page: number, search: string): string => {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("webhookPage", String(page));
  }
  if (search) {
    params.set("webhookQ", search);
  }
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : "/admin/auditoria";
};

const outboxPageHref = (page: number): string =>
  page > 1 ? `/admin/auditoria?outboxPage=${page}` : "/admin/auditoria";

const OPERATIONAL_ALERT_PRESENTATION = {
  email_delivery_dead_letter: {
    description:
      "Há eventos do Resend que não puderam atualizar o lifecycle e exigem investigação.",
    title: "Eventos de entrega em dead letter",
  },
  email_delivery_retry_stale: {
    description:
      "Há eventos do Resend aguardando correlação há mais de uma hora.",
    title: "Lifecycle de e-mail atrasado",
  },
  outbox_dead_letter: {
    description:
      "Há mensagens que esgotaram as tentativas e exigem revisão manual.",
    title: "Mensagens em dead letter",
  },
  outbox_pending_stale: {
    description:
      "A mensagem pendente mais antiga ultrapassou o limite operacional.",
    title: "Outbox com atraso",
  },
  webhook_failed_stale: {
    description:
      "Há webhooks falhos aguardando investigação além do limite operacional.",
    title: "Falhas persistentes de webhook",
  },
  webhook_payload_retention_risk: {
    description:
      "Há payloads de webhook próximos da remoção obrigatória por retenção.",
    title: "Risco de retenção de webhook",
  },
  webhook_ready_stale: {
    description:
      "Há webhooks aguardando processamento além do limite operacional.",
    title: "Webhooks aguardando processamento",
  },
  webhook_retry_stale: {
    description: "Há webhooks em nova tentativa além do limite operacional.",
    title: "Novas tentativas de webhook atrasadas",
  },
} satisfies Record<
  OperationalAlert["code"],
  { description: string; title: string }
>;

const OPERATIONAL_ALERT_SEVERITY = {
  critical: {
    alertClassName: "border-destructive/30 bg-destructive/10",
    alertVariant: "destructive",
    badgeVariant: "destructive",
    label: "Crítico",
  },
  high: {
    alertClassName: "border-destructive/20",
    alertVariant: "destructive",
    badgeVariant: "destructive",
    label: "Alta prioridade",
  },
  warning: {
    alertClassName: "bg-muted/30",
    alertVariant: "default",
    badgeVariant: "outline",
    label: "Atenção",
  },
} satisfies Record<
  OperationalAlert["severity"],
  {
    alertClassName: string;
    alertVariant: "default" | "destructive";
    badgeVariant: "destructive" | "outline";
    label: string;
  }
>;

function formatAuditMessage(log: {
  action: string;
  targetName: string | null;
  targetType: string;
}): string {
  const target = log.targetName
    ? `"${log.targetName}"`
    : "um registro desconhecido";

  switch (log.action) {
    case "course.created":
      return `Criou o curso ${target}`;
    case "course.updated":
      return `Atualizou o curso ${target}`;
    case "course.deleted":
      return `Excluiu o curso ${target}`;

    case "module.created":
      return `Criou o módulo ${target}`;
    case "module.updated":
      return `Atualizou o módulo ${target}`;
    case "module.deleted":
      return `Excluiu o módulo ${target}`;
    case "module.upserted":
      return `Atualizou o módulo ${target}`;

    case "lesson.created":
      return `Criou a aula ${target}`;
    case "lesson.updated":
      return `Atualizou a aula ${target}`;
    case "lesson.deleted":
      return `Excluiu a aula ${target}`;
    case "lesson.upserted":
      return `Atualizou a aula ${target}`;

    case "course_publication.prepared":
      return `Preparou uma publicação para ${target}`;
    case "course_publication.published":
      return `Publicou o conteúdo de ${target}`;

    case "enrollment.created":
      return `Nova matrícula para ${target}`;
    case "enrollment.updated":
      return `Atualizou a matrícula de ${target}`;
    case "enrollment.deleted":
      return `Cancelou a matrícula de ${target}`;

    case "enrollment.expiration_extended":
      return `Estendeu o prazo da matrícula de ${target}`;
    case "enrollment.expiration_reduced":
      return `Reduziu o prazo da matrícula de ${target}`;
    case "enrollment.expiration_set":
      return `Alterou o prazo da matrícula de ${target}`;
    case "enrollment.payment_paid":
      return `Pagamento aprovado liberou acesso para ${target}`;
    case "enrollment.payment_refunded":
      return `Reembolso revogou acesso para ${target}`;
    case "enrollment.payment_disputed":
      return `Disputa revogou acesso para ${target}`;
    case "enrollment.access_blocked":
      return `Bloqueou o acesso de ${target}`;
    case "enrollment.access_restored":
      return `Restaurou o acesso de ${target}`;

    case "student.created":
      return `Cadastrou a Aluna ${target}`;
    case "student.updated":
      return `Atualizou os dados da Aluna ${target}`;
    case "student.platform_blocked":
      return `Bloqueou ${target} na plataforma`;
    case "student.platform_restored":
      return `Restaurou ${target} na plataforma`;

    case "settings.updated":
      return "Atualizou as configurações globais do sistema";

    case "faq.created":
      return `Criou o FAQ ${target}`;
    case "faq.updated":
      return `Atualizou o FAQ ${target}`;
    case "faq.deleted":
      return `Excluiu o FAQ ${target}`;
    case "faq.reordered":
      return "Reordenou as perguntas frequentes";
    case "banner.saved":
      return `Atualizou o banner ${target}`;
    case "banner.deleted":
      return `Excluiu o banner ${target}`;
    case "banners.reordered":
      return "Reordenou os banners";

    default:
      return `Ação do sistema (${log.action}) efetuada em ${target}`;
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this page composes independent operational sections with role-scoped actions
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<AuditSearchParams>;
} = {}): Promise<React.JSX.Element> {
  const query = (await searchParams) ?? {};
  const requestedWebhookPage = Number.parseInt(
    firstSearchParameter(query.webhookPage),
    10
  );
  const webhookPage = Number.isFinite(requestedWebhookPage)
    ? requestedWebhookPage
    : 1;
  const webhookSearch = firstSearchParameter(query.webhookQ).trim();
  const requestedOutboxPage = Number.parseInt(
    firstSearchParameter(query.outboxPage),
    10
  );
  const outboxPage = Number.isFinite(requestedOutboxPage)
    ? requestedOutboxPage
    : 1;
  const [session, data, webhookEvents] = await Promise.all([
    requirePermission("viewAdminPanel"),
    getAdminAuditData({ outboxPage }),
    getAdminWebhookEvents({ page: webhookPage, search: webhookSearch }),
  ]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Acompanhe as últimas alterações administrativas no sistema."
          title="Registro de auditoria"
        />

        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold text-lg">Sinais operacionais</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Contagens e idades do backlog atual. Investigue itens antigos
              conforme o runbook de observabilidade antes de reprocessar.
            </p>
          </div>
          {data.operationalBacklog.alerts.length > 0 ? (
            <ul className="grid gap-3 border-b p-5 text-sm">
              {data.operationalBacklog.alerts.map((alert) => {
                const presentation = OPERATIONAL_ALERT_PRESENTATION[alert.code];
                const severity = OPERATIONAL_ALERT_SEVERITY[alert.severity];

                return (
                  <li key={alert.code}>
                    <Alert
                      className={severity.alertClassName}
                      role={
                        severity.alertVariant === "destructive"
                          ? "alert"
                          : "status"
                      }
                      variant={severity.alertVariant}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <AlertTitle>{presentation.title}</AlertTitle>
                        <Badge variant={severity.badgeVariant}>
                          {severity.label}
                        </Badge>
                      </div>
                      <AlertDescription>
                        {presentation.description}
                      </AlertDescription>
                    </Alert>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <dl className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
            <div className="space-y-1 p-5">
              <dt className="text-muted-foreground text-sm">Outbox pendente</dt>
              <dd className="font-semibold text-2xl tabular-nums">
                {data.operationalBacklog.outbox.ready}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Mais antiga:{" "}
                {data.operationalBacklog.outbox.oldestReadyAt
                  ? formatDate(data.operationalBacklog.outbox.oldestReadyAt)
                  : "nenhuma"}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Dead letters: {data.operationalBacklog.outbox.deadLetters}
              </dd>
            </div>
            <div className="space-y-1 p-5">
              <dt className="text-muted-foreground text-sm">E-mails aceitos</dt>
              <dd className="font-semibold text-2xl tabular-nums">
                {data.operationalBacklog.emailDelivery.accepted}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Entregues: {data.operationalBacklog.emailDelivery.delivered}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Bounces: {data.operationalBacklog.emailDelivery.bounced} ·
                Reclamações: {data.operationalBacklog.emailDelivery.complained}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Inbox em retry: {data.operationalBacklog.emailDelivery.retrying}
                · Dead letters:{" "}
                {data.operationalBacklog.emailDelivery.deadLetters}
              </dd>
            </div>
            <div className="space-y-1 p-5">
              <dt className="text-muted-foreground text-sm">Webhooks falhos</dt>
              <dd className="font-semibold text-2xl tabular-nums">
                {data.operationalBacklog.webhooks.failed}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Mais antigo:{" "}
                {data.operationalBacklog.webhooks.oldestFailedAt
                  ? formatDate(data.operationalBacklog.webhooks.oldestFailedAt)
                  : "nenhum"}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Na fila: {data.operationalBacklog.webhooks.ready}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Retry: {data.operationalBacklog.webhooks.retryable}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Fila mais antiga:{" "}
                {data.operationalBacklog.webhooks.oldestReadyAt
                  ? formatDate(data.operationalBacklog.webhooks.oldestReadyAt)
                  : "nenhuma"}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Retry mais antigo:{" "}
                {data.operationalBacklog.webhooks.oldestRetryAt
                  ? formatDate(data.operationalBacklog.webhooks.oldestRetryAt)
                  : "nenhum"}
              </dd>
            </div>
            <div className="space-y-1 p-5">
              <dt className="text-muted-foreground text-sm">
                Pendências financeiras
              </dt>
              <dd className="font-semibold text-2xl tabular-nums">
                {data.operationalBacklog.payments.uncertainCheckouts +
                  data.operationalBacklog.payments.uncertainRefunds +
                  data.operationalBacklog.payments.uncorrelatedOrders}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Checkouts incertos:{" "}
                {data.operationalBacklog.payments.uncertainCheckouts}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Reembolsos incertos:{" "}
                {data.operationalBacklog.payments.uncertainRefunds}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Pedidos sem pagamento:{" "}
                {data.operationalBacklog.payments.uncorrelatedOrders}
              </dd>
            </div>
            <div className="space-y-1 p-5">
              <dt className="text-muted-foreground text-sm">
                Vídeos pendentes
              </dt>
              <dd className="font-semibold text-2xl tabular-nums">
                {data.operationalBacklog.videos.pending}
              </dd>
              <dd className="text-muted-foreground text-sm">
                Mais antigo:{" "}
                {data.operationalBacklog.videos.oldestPendingAt
                  ? formatDate(data.operationalBacklog.videos.oldestPendingAt)
                  : "nenhum"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold text-lg">
              Webhooks que exigem recuperação
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Eventos Asaas falhos ou em retry. O portal do Asaas mostra a
              entrega externa; esta fila mostra o estado local e o efeito no
              Hub.
            </p>
          </div>
          <div className="border-b p-5">
            <form className="flex max-w-xl gap-2" method="get">
              <Input
                aria-label="Buscar webhooks"
                defaultValue={webhookSearch}
                name="webhookQ"
                placeholder="Evento, chave ou erro…"
              />
              <Button type="submit" variant="outline">
                Buscar
              </Button>
            </form>
          </div>
          {webhookEvents.events.length ? (
            <div className="divide-y">
              {webhookEvents.events.map((event) => {
                const status = getWebhookStatusPresentation(event.status);

                return (
                  <article className="p-5" key={event.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">
                            {event.eventName}
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="mt-1 break-all font-mono text-muted-foreground text-xs">
                          {event.eventKey}
                        </p>
                        {event.errorMessage ? (
                          <p className="mt-2 text-destructive text-sm">
                            {event.errorMessage}
                          </p>
                        ) : null}
                      </div>
                      <dl className="grid shrink-0 gap-1 text-right text-xs">
                        <div>
                          <dt className="sr-only">Criado em</dt>
                          <dd className="text-muted-foreground">
                            {formatDate(event.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Tentativas</dt>
                          <dd className="font-medium tabular-nums">
                            {event.attemptCount}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {session.role === "admin" ? (
                      <RetryWebhookOperation webhookEventId={event.id} />
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="p-5 text-muted-foreground text-sm">
              Nenhum webhook falho ou em retry encontrado.
            </p>
          )}
          {webhookEvents.page > 1 || webhookEvents.hasNextPage ? (
            <nav
              aria-label="Paginação de webhooks"
              className="flex items-center justify-between border-t p-5"
            >
              {webhookEvents.page > 1 ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={route(
                    auditPageHref(webhookEvents.page - 1, webhookSearch)
                  )}
                >
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              {webhookEvents.hasNextPage ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={route(
                    auditPageHref(webhookEvents.page + 1, webhookSearch)
                  )}
                >
                  Próximos
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold text-lg">
              Mensagens pendentes de revisão
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Dead letters não são reenviadas automaticamente. Somente
              administradores podem reprocessar uma vez, informando o motivo.
            </p>
          </div>
          {data.outboxDeadLetters.messages.length ? (
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {data.outboxDeadLetters.messages.map((message) => (
                <article className="rounded-lg border p-4" key={message.id}>
                  <p className="font-medium text-sm">{message.topic}</p>
                  <p className="mt-1 font-mono text-muted-foreground text-xs">
                    {message.id}
                  </p>
                  <dl className="mt-3 grid gap-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Tentativas</dt>
                      <dd className="tabular-nums">{message.attempts}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Falha</dt>
                      <dd>{message.lastErrorCode ?? "não informada"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Última tentativa
                      </dt>
                      <dd>
                        {message.lastErrorAt
                          ? formatDate(message.lastErrorAt)
                          : "não informada"}
                      </dd>
                    </div>
                  </dl>
                  {session.role === "admin" ? (
                    <div className="mt-4">
                      <OutboxDeadLetterReprocess messageId={message.id} />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="p-5 text-muted-foreground text-sm">
              Nenhuma mensagem em dead letter.
            </p>
          )}
          {data.outboxDeadLetters.page > 1 ||
          data.outboxDeadLetters.hasNextPage ? (
            <nav
              aria-label="Paginação de dead letters"
              className="flex items-center justify-between border-t p-5"
            >
              {data.outboxDeadLetters.page > 1 ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={route(outboxPageHref(data.outboxDeadLetters.page - 1))}
                >
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              {data.outboxDeadLetters.hasNextPage ? (
                <Link
                  className="text-sm underline underline-offset-4"
                  href={route(outboxPageHref(data.outboxDeadLetters.page + 1))}
                >
                  Próximas
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableCaption className="sr-only">
              Alterações administrativas recentes
            </TableCaption>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  Data
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.auditLogs.length ? (
                data.auditLogs.map((log) => (
                  <TableRow
                    key={`${log.action}-${log.createdAt.toISOString()}`}
                  >
                    <TableRowHeader className="font-medium text-sm">
                      {formatAuditMessage(log)}
                    </TableRowHeader>
                    <TableCell className="text-muted-foreground">
                      {log.actorEmail ?? "sistema"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-muted-foreground tabular-nums">
                      {formatDate(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={3}
                  >
                    Nenhum registro de auditoria encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageContainer>
  );
}
