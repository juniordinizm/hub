import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  EmptyMedia,
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
import { getAuditFilterHref } from "@/features/admin/audit-filter-url";
import {
  ADMIN_AUDIT_SOURCE_LABELS,
  ADMIN_AUDIT_TARGET_LABELS,
  type AdminAuditSource,
  parseAdminAuditSource,
  parseAdminAuditTargetType,
} from "@/features/admin/audit-filters";
import { getAdminAuditActionLabel } from "@/features/admin/audit-presentation";
import { getAdminAuditData } from "@/features/admin/server";
import { formatDateTime } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { AuditFilterMenu } from "./audit-filter-menu";
import { AuditLogDetailsSheet } from "./audit-log-details-sheet";

export const dynamic = "force-dynamic";

type AuditSearchParams = Record<string, string | string[] | undefined>;

const firstSearchParameter = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const parsePage = (value: string): number => {
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};

const getTargetLabel = (targetType: string): string =>
  ADMIN_AUDIT_TARGET_LABELS[
    targetType as keyof typeof ADMIN_AUDIT_TARGET_LABELS
  ] ?? targetType;

const getSourceLabel = (source: Exclude<AdminAuditSource, "all">): string =>
  ADMIN_AUDIT_SOURCE_LABELS[source];

const getAuditSummary = ({
  count,
  page,
  pageSize,
  totalCount,
}: {
  count: number;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  const formattedTotal = totalCount.toLocaleString("pt-BR");
  if (totalCount === 0) {
    return "Nenhum evento de auditoria encontrado";
  }
  if (count === 0) {
    return `Nenhum evento nesta página · ${formattedTotal} no total`;
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + count - 1, totalCount);
  return `${firstResult.toLocaleString("pt-BR")}–${lastResult.toLocaleString("pt-BR")} de ${formattedTotal} evento${totalCount === 1 ? "" : "s"}`;
};

const getAuditEmptyTitle = ({
  hasActiveFilter,
  totalCount,
}: {
  hasActiveFilter: boolean;
  totalCount: number;
}): string => {
  if (totalCount > 0) {
    return "Nenhum evento nesta página";
  }
  return hasActiveFilter
    ? "Nenhum evento corresponde aos filtros"
    : "Nenhum evento de auditoria";
};

const getAuditEmptyDescription = ({
  hasActiveFilter,
  totalCount,
}: {
  hasActiveFilter: boolean;
  totalCount: number;
}): string => {
  if (totalCount > 0) {
    return "Volte uma página para continuar consultando o histórico.";
  }
  return hasActiveFilter
    ? "Ajuste ou limpe os filtros para consultar outro conjunto de eventos."
    : "Ainda não há alterações administrativas registradas.";
};

const getLegacyOperationsRedirect = (
  params: AuditSearchParams
): string | null => {
  const legacyKeys = ["outboxPage", "webhookPage", "webhookQ"] as const;
  const legacyParams = new URLSearchParams();
  for (const key of legacyKeys) {
    const value = firstSearchParameter(params[key]);
    if (value) {
      legacyParams.set(key, value);
    }
  }
  const query = legacyParams.toString();
  return query ? `/admin/operacao?${query}` : null;
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<AuditSearchParams>;
} = {}): Promise<React.JSX.Element> {
  const params = (await searchParams) ?? {};
  const legacyOperationsRedirect = getLegacyOperationsRedirect(params);
  if (legacyOperationsRedirect) {
    redirect(route(legacyOperationsRedirect));
  }

  const search = firstSearchParameter(params.q).trim();
  const source = parseAdminAuditSource(
    firstSearchParameter(params.source).trim()
  );
  const targetType = parseAdminAuditTargetType(
    firstSearchParameter(params.target).trim()
  );
  const from = firstSearchParameter(params.from).trim();
  const to = firstSearchParameter(params.to).trim();
  const page = parsePage(firstSearchParameter(params.page));
  const hasActiveFilter = Boolean(
    search || from || to || source !== "all" || targetType !== "all"
  );
  const data = await getAdminAuditData({
    page,
    search,
    source,
    targetType,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          description="Consulte alterações administrativas e eventos relevantes de matrícula e acesso."
          title="Auditoria administrativa"
        />

        <Card className="min-w-0">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle as="h2" className="text-base">
                    Eventos registrados
                  </CardTitle>
                  <FinanceHelp
                    description="A auditoria mostra decisões administrativas e eventos de acesso. Filas de webhook, Outbox e dead letters ficam em Operação."
                    details={[
                      "A origem diferencia alterações administrativas de eventos de Matrícula e acesso.",
                      "Os dados técnicos exibidos aqui são referências seguras; payloads de integração e e-mails não fazem parte do histórico global.",
                      "Use os detalhes para confirmar o código, o alvo e o horário exato do evento.",
                    ]}
                    title="Como ler a auditoria"
                  />
                  <Badge variant="secondary">
                    {data.totalCount.toLocaleString("pt-BR")}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  Busque por ação, curso, responsável, e-mail ou identificador e
                  abra os detalhes do evento.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <form
                aria-label="Busca da auditoria"
                className="flex min-w-0 flex-1 basis-full gap-2 sm:max-w-xl sm:basis-auto"
                method="get"
              >
                <input name="page" type="hidden" value="1" />
                <input name="source" type="hidden" value={source} />
                <input name="target" type="hidden" value={targetType} />
                <input name="from" type="hidden" value={from} />
                <input name="to" type="hidden" value={to} />
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <label className="sr-only" htmlFor="audit-search">
                    Buscar eventos de auditoria
                  </label>
                  <Input
                    autoComplete="off"
                    defaultValue={search}
                    id="audit-search"
                    name="q"
                    placeholder="Ação, curso, responsável ou ID…"
                  />
                </div>
                <Button type="submit">Buscar</Button>
              </form>
              <AuditFilterMenu
                from={from}
                search={search}
                source={source}
                targetType={targetType}
                to={to}
              />
            </div>

            <div className="rounded-lg border">
              <Table className="min-w-[960px]">
                <TableCaption className="sr-only">
                  Eventos administrativos e de matrícula registrados
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>O que foi feito</TableHead>
                    <TableHead>Onde</TableHead>
                    <TableHead>Como</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Quando
                    </TableHead>
                    <TableHead className="w-1 text-right">
                      <span className="sr-only">Detalhes</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.auditLogs.length > 0 ? (
                    data.auditLogs.map((log) => (
                      <TableRow key={`${log.source}-${log.id}`}>
                        <TableRowHeader className="min-w-52 whitespace-nowrap font-medium text-sm">
                          {getAdminAuditActionLabel(log.action)}
                        </TableRowHeader>
                        <TableCell className="max-w-64 truncate">
                          {log.targetName ??
                            log.metadata?.targetLabelAfter ??
                            log.metadata?.targetLabelBefore ??
                            getTargetLabel(log.targetType)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {getSourceLabel(log.source)}
                        </TableCell>
                        <TableCell className="max-w-40 truncate">
                          {log.actorName ?? "Sistema"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground text-xs tabular-nums">
                          <time dateTime={log.createdAt.toISOString()}>
                            {formatDateTime(log.createdAt)}
                          </time>
                        </TableCell>
                        <TableCell className="text-right">
                          <AuditLogDetailsSheet log={log} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="h-56 p-0" colSpan={6}>
                        <Empty className="rounded-none border-0 p-8">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <HugeiconsIcon
                                aria-hidden="true"
                                icon={HistoryIcon}
                              />
                            </EmptyMedia>
                            <EmptyTitle as="h3">
                              {getAuditEmptyTitle({
                                hasActiveFilter,
                                totalCount: data.totalCount,
                              })}
                            </EmptyTitle>
                            <EmptyDescription>
                              {getAuditEmptyDescription({
                                hasActiveFilter,
                                totalCount: data.totalCount,
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
                {getAuditSummary({
                  count: data.auditLogs.length,
                  page: data.page,
                  pageSize: data.pageSize,
                  totalCount: data.totalCount,
                })}
              </span>
              {data.page > 1 || data.hasNextPage ? (
                <nav aria-label="Paginação da auditoria" className="flex gap-2">
                  {data.page > 1 ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getAuditFilterHref({
                            from,
                            page: data.page - 1,
                            search,
                            source,
                            targetType,
                            to,
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
                  {data.hasNextPage ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={route(
                          getAuditFilterHref({
                            from,
                            page: data.page + 1,
                            search,
                            source,
                            targetType,
                            to,
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
      </div>
    </PageContainer>
  );
}
