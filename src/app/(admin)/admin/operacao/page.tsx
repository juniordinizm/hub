import Link from "next/link";
import { FinanceHelp } from "@/components/admin/finance-help";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { getAdminOperationsData } from "@/features/admin/server";
import { getWebhookStatusPresentation } from "@/features/admin/status-presentation";
import { JMVSTREAM_PORTAL_URL } from "@/features/jmvstream/portal";
import {
  getJmvstreamHealthSummary,
  type JmvstreamHealthSummary,
} from "@/features/jmvstream/server";
import type {
  OperationalAlert,
  OperationalBacklogSnapshot,
} from "@/features/operations/server";
import { formatDateTime } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { OutboxDeadLetterDialog } from "./outbox-dead-letter-dialog";
import { WebhookRecoveryDialog } from "./webhook-recovery-dialog";

export const dynamic = "force-dynamic";

type OperationsSearchParams = Record<string, string | string[] | undefined>;

const firstSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const parsePage = (value: string): number => {
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

const ALERT_PRESENTATION: Record<
  OperationalAlert["code"],
  { description: string; href: string; title: string }
> = {
  email_delivery_dead_letter: {
    description:
      "Eventos de entrega não atualizaram o estado local e exigem investigação.",
    href: "#outros-sinais",
    title: "Entrega de e-mail em dead letter",
  },
  email_delivery_retry_stale: {
    description:
      "Eventos de entrega estão aguardando correlação há mais de uma hora.",
    href: "#outros-sinais",
    title: "Entrega de e-mail atrasada",
  },
  outbox_dead_letter: {
    description:
      "Mensagens esgotaram as tentativas automáticas e exigem revisão manual.",
    href: "#outbox",
    title: "Mensagens em dead letter",
  },
  outbox_pending_stale: {
    description:
      "A mensagem pendente mais antiga ultrapassou o limite operacional.",
    href: "#outbox",
    title: "Outbox com atraso",
  },
  webhook_failed_stale: {
    description:
      "Webhooks falhos aguardam investigação além do limite operacional.",
    href: "#webhooks",
    title: "Falhas persistentes de webhook",
  },
  webhook_payload_retention_risk: {
    description:
      "Há evidências de webhook próximas da sanitização obrigatória por retenção.",
    href: "#webhooks",
    title: "Risco de retenção de webhook",
  },
  webhook_ready_stale: {
    description: "Webhooks aguardam processamento além do limite operacional.",
    href: "#webhooks",
    title: "Webhooks aguardando processamento",
  },
  webhook_retry_stale: {
    description:
      "Webhooks em retry estão sem nova tentativa dentro do limite esperado.",
    href: "#webhooks",
    title: "Retry de webhook atrasado",
  },
};

const SEVERITY_PRESENTATION = {
  critical: {
    alertVariant: "destructive" as const,
    badgeVariant: "destructive" as const,
    label: "Crítico",
  },
  high: {
    alertVariant: "warning" as const,
    badgeVariant: "warning" as const,
    label: "Alta prioridade",
  },
  warning: {
    alertVariant: "warning" as const,
    badgeVariant: "outline" as const,
    label: "Atenção",
  },
};

const formatAge = (date: Date | null, now: Date): string => {
  if (!date) {
    return "sem registro";
  }
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60_000)
  );
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  return `${Math.floor(hours / 24)} d`;
};

const getAlertContext = (
  code: OperationalAlert["code"],
  backlog: OperationalBacklogSnapshot
): { count: number; oldestAt: Date | null } => {
  switch (code) {
    case "email_delivery_dead_letter":
      return {
        count: backlog.emailDelivery.deadLetters,
        oldestAt: backlog.emailDelivery.oldestRetryAt,
      };
    case "email_delivery_retry_stale":
      return {
        count: backlog.emailDelivery.retrying,
        oldestAt: backlog.emailDelivery.oldestRetryAt,
      };
    case "outbox_dead_letter":
      return { count: backlog.outbox.deadLetters, oldestAt: null };
    case "outbox_pending_stale":
      return {
        count: backlog.outbox.ready,
        oldestAt: backlog.outbox.oldestReadyAt,
      };
    case "webhook_failed_stale":
      return {
        count: backlog.webhooks.failed,
        oldestAt: backlog.webhooks.oldestFailedAt,
      };
    case "webhook_payload_retention_risk":
      return {
        count:
          backlog.webhooks.failed +
          backlog.webhooks.ready +
          backlog.webhooks.retryable,
        oldestAt:
          backlog.webhooks.oldestFailedAt ?? backlog.webhooks.oldestRetryAt,
      };
    case "webhook_ready_stale":
      return {
        count: backlog.webhooks.ready,
        oldestAt: backlog.webhooks.oldestReadyAt,
      };
    case "webhook_retry_stale":
      return {
        count: backlog.webhooks.retryable,
        oldestAt: backlog.webhooks.oldestRetryAt,
      };
    default:
      return { count: 0, oldestAt: null };
  }
};

const getPageHref = ({
  outboxPage,
  webhookPage,
  webhookSearch,
}: {
  outboxPage: number;
  webhookPage: number;
  webhookSearch: string;
}): string => {
  const params = new URLSearchParams();
  if (webhookPage > 1) {
    params.set("webhookPage", String(webhookPage));
  }
  if (outboxPage > 1) {
    params.set("outboxPage", String(outboxPage));
  }
  if (webhookSearch) {
    params.set("webhookQ", webhookSearch);
  }
  const query = params.toString();
  return query ? `/admin/operacao?${query}` : "/admin/operacao";
};

const getResultSummary = ({
  count,
  label,
  page,
  pageSize,
  totalCount,
}: {
  count: number;
  label: string;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return `Nenhum ${label} encontrado`;
  }
  if (count === 0) {
    return `Nenhum ${label} nesta página · ${totalCount.toLocaleString("pt-BR")} no total`;
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + count - 1, totalCount);
  return `${firstResult.toLocaleString("pt-BR")}–${lastResult.toLocaleString("pt-BR")} de ${totalCount.toLocaleString("pt-BR")} ${label}`;
};

const getWebhookEmptyTitle = ({
  search,
  totalCount,
}: {
  search: string;
  totalCount: number;
}): string => {
  if (totalCount > 0) {
    return "Nenhum webhook nesta página";
  }
  if (search) {
    return "Nenhum webhook corresponde à busca";
  }
  return "Nenhum webhook para recuperar";
};

const getWebhookEmptyDescription = ({
  search,
  totalCount,
}: {
  search: string;
  totalCount: number;
}): string => {
  if (totalCount > 0) {
    return "Volte uma página para continuar consultando os eventos.";
  }
  if (search) {
    return "Ajuste ou limpe a busca para consultar outro conjunto de eventos.";
  }
  return "Não há webhook falho ou em retry para os filtros atuais.";
};

const getSafeJmvstreamHealthSummary =
  async (): Promise<JmvstreamHealthSummary> => {
    try {
      return await getJmvstreamHealthSummary();
    } catch {
      return {
        auth: "error",
        failedDeletes: 0,
        failedUploads: 0,
        folderCount: 0,
        message: "Não foi possível consultar a JMVStream agora.",
        orphanFolders: 0,
        pendingDeletes: 0,
        processingUploads: 0,
      };
    }
  };

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this page composes independent operational sections and their empty, pagination, and permission states
export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<OperationsSearchParams>;
} = {}): Promise<React.JSX.Element> {
  const params = (await searchParams) ?? {};
  const webhookSearch = firstSearchParameter(params.webhookQ).trim();
  const webhookPage = parsePage(firstSearchParameter(params.webhookPage));
  const outboxPage = parsePage(firstSearchParameter(params.outboxPage));
  const [data, jmvstreamHealth] = await Promise.all([
    getAdminOperationsData({
      outboxPage,
      webhookPage,
      webhookSearch,
    }),
    getSafeJmvstreamHealthSummary(),
  ]);
  const backlog = data.operationalBacklog;
  const now = new Date();

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Acompanhe filas, alertas e recuperações que precisam de atenção operacional."
          title="Operações e recuperação"
        />

        <Card className="min-w-0">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1">
                  <CardTitle as="h2" className="text-base">
                    Alertas operacionais
                  </CardTitle>
                  <FinanceHelp
                    description="Esta página mostra o estado atual das filas locais e as ações de recuperação autorizadas."
                    details={[
                      "A idade indica há quanto tempo o item mais antigo aguarda uma transição local.",
                      "Webhook é uma entrada recebida do Asaas; Outbox é uma intenção local de efeito externo.",
                      "Reprocessar exige motivo e deve ser feito somente depois de conferir o agregado relacionado.",
                    ]}
                    title="Como usar Operações"
                  />
                </div>
                <CardDescription className="mt-1">
                  Cada alerta aponta para a fila responsável pela próxima
                  verificação.
                </CardDescription>
              </div>
              <Badge
                className="shrink-0 tabular-nums"
                variant={backlog.alerts.length > 0 ? "destructive" : "success"}
              >
                {backlog.alerts.length.toLocaleString("pt-BR")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {backlog.alerts.length > 0 ? (
              backlog.alerts.map((alert) => {
                const presentation = ALERT_PRESENTATION[alert.code];
                const severity = SEVERITY_PRESENTATION[alert.severity];
                const context = getAlertContext(alert.code, backlog);

                return (
                  <div
                    className="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    key={alert.code}
                    role={
                      severity.alertVariant === "destructive"
                        ? "alert"
                        : "status"
                    }
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">
                          {presentation.title}
                        </span>
                        <Badge variant={severity.badgeVariant}>
                          {severity.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                        {presentation.description}
                      </p>
                      <p className="mt-2 text-xs">
                        <span className="font-medium tabular-nums">
                          {context.count.toLocaleString("pt-BR")}
                        </span>{" "}
                        item{context.count === 1 ? "" : "s"} · mais antigo:{" "}
                        {formatAge(context.oldestAt, now)}
                        {context.oldestAt
                          ? ` · ${formatDateTime(context.oldestAt)}`
                          : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={route(presentation.href)}>Abrir fila</Link>
                    </Button>
                  </div>
                );
              })
            ) : (
              <Empty className="col-span-full border-0 py-8">
                <EmptyHeader>
                  <EmptyTitle as="h3">Nenhum alerta ativo</EmptyTitle>
                  <EmptyDescription>
                    As filas estão dentro dos limiares definidos no runbook de
                    observabilidade.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="jmvstream-health-title" id="jmvstream">
          <Card className="min-w-0">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle
                      as="h2"
                      className="text-base"
                      id="jmvstream-health-title"
                    >
                      Saúde da JMVStream
                    </CardTitle>
                    <Badge
                      variant={
                        jmvstreamHealth.auth === "ok"
                          ? "success"
                          : "destructive"
                      }
                    >
                      {jmvstreamHealth.auth === "ok"
                        ? "Conectada"
                        : "Revisar conexão"}
                    </Badge>
                    <FinanceHelp
                      description="Acompanhe a conexão e as pendências locais da integração de vídeo."
                      details={[
                        "Uploads ativos e exclusões pendentes ainda estão em processamento local.",
                        "Falhas e pastas órfãs precisam ser conferidas antes de uma nova tentativa.",
                        "O portal JMVStream mostra o estado externo da integração.",
                      ]}
                      title="Como ler a saúde da JMVStream"
                    />
                  </div>
                  <CardDescription className="mt-1">
                    {jmvstreamHealth.message}
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={JMVSTREAM_PORTAL_URL}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Abrir portal JMVStream
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              <JmvstreamHealthMetric
                label="Uploads ativos"
                value={jmvstreamHealth.processingUploads}
              />
              <JmvstreamHealthMetric
                label="Uploads com falha"
                value={jmvstreamHealth.failedUploads}
              />
              <JmvstreamHealthMetric
                label="Exclusões pendentes"
                value={jmvstreamHealth.pendingDeletes}
              />
              <JmvstreamHealthMetric
                label="Exclusões com falha"
                value={jmvstreamHealth.failedDeletes}
              />
              <JmvstreamHealthMetric
                label="Pastas sincronizadas"
                value={jmvstreamHealth.folderCount}
              />
              <JmvstreamHealthMetric
                label="Pastas órfãs"
                value={jmvstreamHealth.orphanFolders}
              />
            </CardContent>
          </Card>
        </section>

        <Card className="min-w-0" id="webhooks">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-1">
              <CardTitle as="h2" className="text-base">
                Webhooks que exigem recuperação
              </CardTitle>
              <FinanceHelp
                description="A fila mostra o estado local do processamento Asaas; o portal do provedor é a evidência da entrega externa."
                details={[
                  "Retry só deve acontecer depois de conferir o Pedido e a cobrança relacionados.",
                  "O código e a mensagem de erro ajudam a identificar a causa sem expor o payload bruto.",
                ]}
                title="Recuperação de webhooks"
              />
            </div>
            <CardDescription>
              Eventos Asaas falhos ou em retry. Confira o estado local antes de
              reenfileirar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
              {outboxPage > 1 ? (
                <input name="outboxPage" type="hidden" value={outboxPage} />
              ) : null}
              <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-xl">
                <label className="type-label" htmlFor="webhook-search">
                  Buscar webhook
                </label>
                <Input
                  autoComplete="off"
                  defaultValue={webhookSearch}
                  id="webhook-search"
                  name="webhookQ"
                  placeholder="Evento, chave ou erro…"
                />
              </div>
              <Button type="submit">Buscar</Button>
              {webhookSearch ? (
                <Button asChild type="button" variant="outline">
                  <Link
                    href={route(
                      getPageHref({
                        outboxPage,
                        webhookPage: 1,
                        webhookSearch: "",
                      })
                    )}
                  >
                    Limpar
                  </Link>
                </Button>
              ) : null}
            </form>
            <div className="rounded-lg border">
              <Table className="min-w-[900px]">
                <TableCaption className="sr-only">
                  Webhooks Asaas para recuperação
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead className="w-1">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.webhookEvents.events.length > 0 ? (
                    data.webhookEvents.events.map((event) => {
                      const status = getWebhookStatusPresentation(event.status);
                      return (
                        <TableRow key={event.id}>
                          <TableRowHeader className="min-w-64">
                            <span className="font-medium text-sm">
                              {event.eventName}
                            </span>
                            <span className="type-code mt-1 block break-all text-muted-foreground">
                              {event.eventKey}
                            </span>
                            {event.errorMessage ? (
                              <span className="mt-2 block max-w-xl break-words text-destructive text-xs">
                                {event.errorMessage}
                              </span>
                            ) : null}
                          </TableRowHeader>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                            <time dateTime={event.createdAt.toISOString()}>
                              {formatDateTime(event.createdAt)}
                            </time>
                          </TableCell>
                          <TableCell className="min-w-32 text-muted-foreground text-xs">
                            <span className="block tabular-nums">
                              {event.attemptCount}
                            </span>
                            <span className="mt-1 block">
                              Próximo:{" "}
                              {event.nextAttemptAt
                                ? formatDateTime(event.nextAttemptAt)
                                : "não agendado"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <WebhookRecoveryDialog
                              canRetry={data.canRetryWebhook}
                              event={event}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell className="h-48 p-0" colSpan={5}>
                        <Empty className="rounded-none border-0 p-8">
                          <EmptyHeader>
                            <EmptyTitle as="h3">
                              {getWebhookEmptyTitle({
                                search: webhookSearch,
                                totalCount: data.webhookEvents.totalCount,
                              })}
                            </EmptyTitle>
                            <EmptyDescription>
                              {getWebhookEmptyDescription({
                                search: webhookSearch,
                                totalCount: data.webhookEvents.totalCount,
                              })}
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Separator className="mt-4" />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <span
                aria-live="polite"
                className="text-muted-foreground text-sm"
              >
                {getResultSummary({
                  count: data.webhookEvents.events.length,
                  label:
                    "webhook" +
                    (data.webhookEvents.totalCount === 1 ? "" : "s"),
                  page: data.webhookEvents.page,
                  pageSize: data.webhookEvents.pageSize,
                  totalCount: data.webhookEvents.totalCount,
                })}
              </span>
              {data.webhookEvents.page > 1 || data.webhookEvents.hasNextPage ? (
                <nav aria-label="Paginação de webhooks" className="flex gap-2">
                  {data.webhookEvents.page > 1 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getPageHref({
                            outboxPage,
                            webhookPage: data.webhookEvents.page - 1,
                            webhookSearch,
                          })
                        )}
                      >
                        Anteriores
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled size="sm" variant="outline">
                      Anteriores
                    </Button>
                  )}
                  {data.webhookEvents.hasNextPage ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getPageHref({
                            outboxPage,
                            webhookPage: data.webhookEvents.page + 1,
                            webhookSearch,
                          })
                        )}
                      >
                        Próximos
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled size="sm" variant="outline">
                      Próximos
                    </Button>
                  )}
                </nav>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0" id="outbox">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-1">
              <CardTitle as="h2" className="text-base">
                Mensagens em dead letter
              </CardTitle>
              <FinanceHelp
                description="Dead letter significa que a Outbox esgotou as tentativas automáticas e precisa de revisão manual."
                details={[
                  "O reprocessamento não altera o payload e só pode acontecer uma vez.",
                  "Depois de 24 horas, aceite o risco de duplicar um e-mail com resultado ambíguo.",
                ]}
                title="Mensagens em dead letter"
              />
            </div>
            <CardDescription>
              Mensagens que esgotaram as tentativas automáticas e aguardam uma
              decisão do Administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table className="min-w-[860px]">
                <TableCaption className="sr-only">
                  Mensagens da Outbox em dead letter
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tópico</TableHead>
                    <TableHead>Falha</TableHead>
                    <TableHead>Última tentativa</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead className="w-1">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.outboxDeadLetters.messages.length > 0 ? (
                    data.outboxDeadLetters.messages.map((message) => (
                      <TableRow key={message.id}>
                        <TableRowHeader className="min-w-56">
                          <span className="font-medium text-sm">
                            {message.topic}
                          </span>
                          <span className="type-code mt-1 block break-all text-muted-foreground">
                            {message.id}
                          </span>
                        </TableRowHeader>
                        <TableCell className="min-w-40">
                          <span className="type-code break-words">
                            {message.lastErrorCode ?? "não informada"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
                          {message.lastErrorAt
                            ? formatDateTime(message.lastErrorAt)
                            : "não informada"}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {message.attempts}
                        </TableCell>
                        <TableCell className="text-right">
                          <OutboxDeadLetterDialog
                            canRetry={data.canRetryOutbox}
                            message={message}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="h-48 p-0" colSpan={5}>
                        <Empty className="rounded-none border-0 p-8">
                          <EmptyHeader>
                            <EmptyTitle as="h3">
                              {data.outboxDeadLetters.totalCount > 0
                                ? "Nenhuma mensagem nesta página"
                                : "Nenhuma mensagem em dead letter"}
                            </EmptyTitle>
                            <EmptyDescription>
                              {data.outboxDeadLetters.totalCount > 0
                                ? "Volte uma página para continuar consultando a fila."
                                : "A Outbox não tem mensagens aguardando revisão manual."}
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Separator className="mt-4" />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <span
                aria-live="polite"
                className="text-muted-foreground text-sm"
              >
                {getResultSummary({
                  count: data.outboxDeadLetters.messages.length,
                  label: `mensagem${data.outboxDeadLetters.totalCount === 1 ? "" : "s"} em dead letter`,
                  page: data.outboxDeadLetters.page,
                  pageSize: data.outboxDeadLetters.pageSize,
                  totalCount: data.outboxDeadLetters.totalCount,
                })}
              </span>
              {data.outboxDeadLetters.page > 1 ||
              data.outboxDeadLetters.hasNextPage ? (
                <nav
                  aria-label="Paginação de dead letters"
                  className="flex gap-2"
                >
                  {data.outboxDeadLetters.page > 1 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getPageHref({
                            outboxPage: data.outboxDeadLetters.page - 1,
                            webhookPage,
                            webhookSearch,
                          })
                        )}
                      >
                        Anteriores
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled size="sm" variant="outline">
                      Anteriores
                    </Button>
                  )}
                  {data.outboxDeadLetters.hasNextPage ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getPageHref({
                            outboxPage: data.outboxDeadLetters.page + 1,
                            webhookPage,
                            webhookSearch,
                          })
                        )}
                      >
                        Próximas
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled size="sm" variant="outline">
                      Próximas
                    </Button>
                  )}
                </nav>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="other-signals-title" id="outros-sinais">
          <div className="mb-3 flex items-center gap-1">
            <h2 className="type-section-title" id="other-signals-title">
              Outros sinais operacionais
            </h2>
            <FinanceHelp
              description="Estes números ajudam a direcionar a investigação, mas a decisão acontece na área de origem."
              details={[
                "Pendências financeiras devem ser revisadas em Financeiro.",
                "Vídeos pendentes devem ser acompanhados no fluxo de conteúdo e JMVStream.",
                "Entrega de e-mail mostra o estado local; aceite pelo provedor não garante entrega final.",
              ]}
              title="Outros sinais"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="min-w-0">
              <CardHeader className="pb-4">
                <CardTitle as="h3" className="text-base">
                  Entrega de e-mail
                </CardTitle>
                <CardDescription>
                  Estado local do provedor de e-mail.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="text-muted-foreground">
                  Aceitos:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.emailDelivery.accepted.toLocaleString("pt-BR")}
                  </strong>
                </p>
                <p className="text-muted-foreground">
                  Entregues:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.emailDelivery.delivered.toLocaleString("pt-BR")}
                  </strong>
                </p>
                <p className="text-muted-foreground">
                  Retry:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.emailDelivery.retrying.toLocaleString("pt-BR")}
                  </strong>{" "}
                  · Dead letter:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.emailDelivery.deadLetters.toLocaleString("pt-BR")}
                  </strong>
                </p>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-4">
                <CardTitle as="h3" className="text-base">
                  Pendências financeiras
                </CardTitle>
                <CardDescription>
                  Exceções que pertencem ao Financeiro.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="text-muted-foreground">
                  Checkouts incertos:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.payments.uncertainCheckouts.toLocaleString(
                      "pt-BR"
                    )}
                  </strong>
                </p>
                <p className="text-muted-foreground">
                  Reembolsos incertos:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.payments.uncertainRefunds.toLocaleString("pt-BR")}
                  </strong>
                </p>
                <p className="text-muted-foreground">
                  Pedidos sem correlação:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.payments.uncorrelatedOrders.toLocaleString(
                      "pt-BR"
                    )}
                  </strong>
                </p>
                <Link
                  className="mt-1 text-sm underline underline-offset-4"
                  href={route("/admin/financeiro")}
                >
                  Abrir Financeiro
                </Link>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-4">
                <CardTitle as="h3" className="text-base">
                  Vídeos pendentes
                </CardTitle>
                <CardDescription>
                  Itens que dependem do fluxo de conteúdo.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="text-muted-foreground">
                  Pendentes:{" "}
                  <strong className="text-foreground tabular-nums">
                    {backlog.videos.pending.toLocaleString("pt-BR")}
                  </strong>
                </p>
                <p className="text-muted-foreground">
                  Mais antigo:{" "}
                  {backlog.videos.oldestPendingAt
                    ? formatDateTime(backlog.videos.oldestPendingAt)
                    : "nenhum"}
                </p>
                <Link
                  className="mt-1 text-sm underline underline-offset-4"
                  href={route("/admin/cursos")}
                >
                  Abrir cursos
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function JmvstreamHealthMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/10 p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-lg tabular-nums">
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}
