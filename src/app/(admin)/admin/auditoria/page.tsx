import { PageContainer } from "@/components/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getAdminAuditData } from "@/features/admin/server";
import type { OperationalAlert } from "@/features/operations/server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatDate } from "@/lib/formatters";
import { OutboxDeadLetterReprocess } from "./outbox-dead-letters";

export const dynamic = "force-dynamic";

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

    case "lesson.created":
      return `Criou a aula ${target}`;
    case "lesson.updated":
      return `Atualizou a aula ${target}`;
    case "lesson.deleted":
      return `Excluiu a aula ${target}`;

    case "enrollment.created":
      return `Nova matrícula para ${target}`;
    case "enrollment.updated":
      return `Atualizou a matrícula de ${target}`;
    case "enrollment.deleted":
      return `Cancelou a matrícula de ${target}`;

    case "enrollment.expiration_extended":
      return `Estendeu o prazo da matricula de ${target}`;
    case "enrollment.expiration_reduced":
      return `Reduziu o prazo da matricula de ${target}`;
    case "enrollment.expiration_set":
      return `Alterou o prazo da matricula de ${target}`;
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
      return `Cadastrou o aluno ${target}`;
    case "student.updated":
      return `Atualizou os dados do aluno ${target}`;
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

    default:
      return `Ação do sistema (${log.action}) efetuada em ${target}`;
  }
}

export default async function AuditoriaPage(): Promise<React.JSX.Element> {
  const [session, data] = await Promise.all([
    requirePermission("viewAdminPanel"),
    getAdminAuditData(),
  ]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Registro de Auditoria
              </h1>
              <p className="text-muted-foreground text-sm">
                Acompanhe as últimas alterações administrativas no sistema.
              </p>
            </div>
          </div>
        </header>

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
              Mensagens pendentes de revisão
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Dead letters não são reenviadas automaticamente. Somente
              administradores podem reprocessar uma vez, informando o motivo.
            </p>
          </div>
          {data.outboxDeadLetters.length ? (
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {data.outboxDeadLetters.map((message) => (
                <article className="rounded-lg border p-4" key={message.id}>
                  <p className="font-medium text-sm">{message.topic}</p>
                  <p className="mt-1 font-mono text-muted-foreground text-xs">
                    {message.id}
                  </p>
                  <dl className="mt-3 grid gap-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Tentativas</dt>
                      <dd>{message.attempts}</dd>
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
        </section>

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.auditLogs.length ? (
                data.auditLogs.map((log) => (
                  <TableRow
                    key={`${log.action}-${log.createdAt.toISOString()}`}
                  >
                    <TableCell className="font-medium text-sm">
                      {formatAuditMessage(log)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.actorEmail ?? "sistema"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
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
