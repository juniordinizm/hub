"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AUDIT_FIELD_LABELS,
  formatAuditValue,
} from "@/features/admin/audit-change-presentation";
import {
  ADMIN_AUDIT_SOURCE_LABELS,
  ADMIN_AUDIT_TARGET_LABELS,
} from "@/features/admin/audit-filters";
import {
  getAdminAuditActionLabel,
  hasAdminAuditActionLabel,
} from "@/features/admin/audit-presentation";
import type { AdminAuditLog } from "@/features/admin/audit-types";
import { formatDateTime } from "@/lib/formatters";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  support: "Suporte",
  student: "Aluno",
};

const getTargetLabel = (targetType: string): string =>
  ADMIN_AUDIT_TARGET_LABELS[
    targetType as keyof typeof ADMIN_AUDIT_TARGET_LABELS
  ] ?? targetType;

const AUDIT_METADATA_LABELS: Record<string, string> = {
  courseId: "Curso",
  decision: "Decisão",
  errorCode: "Código do erro",
  eventKey: "Chave do evento",
  fromCatalogVisibility: "Visibilidade anterior",
  fromSalesStatus: "Vendas anteriores",
  fromStatus: "Status anterior",
  inserted: "Registros inseridos",
  lessonCount: "Aulas copiadas",
  moduleCount: "Módulos copiados",
  previousStartedAt: "Liberação anterior",
  provider: "Provedor",
  reasonCategory: "Categoria do motivo",
  reasonDetail: "Detalhe do motivo",
  replacedAssetCount: "Artes substituídas",
  resumedFromOffset: "Retomado do registro",
  specSha256: "Impressão digital da configuração",
  source: "Fonte",
  sourcePublicationId: "Versão de origem",
  templateId: "Modelo",
  toPreset: "Novo estado",
  updated: "Registros atualizados",
};

export function AuditLogDetailsSheet({
  log,
}: {
  log: AdminAuditLog;
}): React.JSX.Element {
  const sourceLabel =
    ADMIN_AUDIT_SOURCE_LABELS[
      log.source as keyof typeof ADMIN_AUDIT_SOURCE_LABELS
    ] ?? "Sistema";
  const targetLabel = getTargetLabel(log.targetType);
  const targetName =
    log.targetName ??
    log.metadata.targetLabelAfter ??
    log.metadata.targetLabelBefore ??
    "Sem descrição disponível";
  const changes = Object.entries(log.metadata.changes ?? {});
  const context = Object.entries(log.metadata).filter(
    ([field, value]) =>
      Object.hasOwn(AUDIT_METADATA_LABELS, field) && value !== undefined
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label={`Ver detalhes: ${getAdminAuditActionLabel(log.action)}`}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={ViewIcon}
            size={16}
            strokeWidth={2}
          />
          Detalhes
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg"
        side="right"
      >
        <SheetHeader className="border-b pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle>{getAdminAuditActionLabel(log.action)}</SheetTitle>
            <FinanceHelp
              description="O resumo identifica a ação. As alterações comparam os valores antes e depois; o contexto e as referências ajudam a investigar o evento."
              details={[
                "Responsável mostra nome, função e e-mail quando disponíveis.",
                "Eventos antigos podem não possuir valores detalhados se foram registrados antes da auditoria estruturada.",
                "IDs e códigos servem para suporte e não substituem a leitura do estado atual do registro.",
              ]}
              title="Como ler os detalhes"
            />
          </div>
          <SheetDescription className="break-words">
            {targetLabel} · {sourceLabel} · {formatDateTime(log.createdAt)}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 overscroll-contain">
          <div className="grid gap-3 p-4 sm:p-5">
            <Card density="compact" size="sm">
              <CardHeader className="border-b" density="compact">
                <CardTitle as="h2">Resumo do evento</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Responsável</dt>
                    <dd>{log.actorName ?? "Sistema"}</dd>
                    {log.actorRole ? (
                      <dd className="text-muted-foreground text-xs">
                        {ROLE_LABELS[log.actorRole] ?? log.actorRole}
                      </dd>
                    ) : null}
                    {log.actorEmail ? (
                      <dd className="break-all text-muted-foreground text-xs">
                        {log.actorEmail}
                      </dd>
                    ) : null}
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Quando</dt>
                    <dd>{formatDateTime(log.createdAt)}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Origem</dt>
                    <dd>{sourceLabel}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Registro afetado</dt>
                    <dd className="break-words">{targetName}</dd>
                    <dd className="text-muted-foreground text-xs">
                      {targetLabel}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card density="compact" size="sm">
              <CardHeader className="border-b" density="compact">
                <CardTitle as="h2">Alterações registradas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 px-4 py-3">
                {changes.length > 0 ? (
                  changes.map(([field, change]) => (
                    <div
                      className="grid gap-2 rounded-md border p-2.5"
                      key={field}
                    >
                      <p className="font-medium text-sm">
                        {AUDIT_FIELD_LABELS[field] ?? field}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <span className="text-muted-foreground text-xs">
                            Antes
                          </span>
                          <span className="break-words text-sm">
                            {formatAuditValue(field, change.before)}
                          </span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-muted-foreground text-xs">
                            Depois
                          </span>
                          <span className="break-words font-medium text-sm">
                            {formatAuditValue(field, change.after)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Este evento não possui valores de campo detalhados.
                  </p>
                )}
              </CardContent>
            </Card>

            {log.metadata.reason || context.length > 0 ? (
              <Card density="compact" size="sm">
                <CardHeader className="border-b" density="compact">
                  <CardTitle as="h2">Contexto</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 px-4 py-3 text-sm">
                  {log.metadata.reason ? (
                    <div className="grid gap-1">
                      <span className="text-muted-foreground">Motivo</span>
                      <p className="break-words">{log.metadata.reason}</p>
                    </div>
                  ) : null}
                  {context.length > 0 ? (
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {context.map(([field, value]) => (
                        <div className="grid gap-1" key={field}>
                          <dt className="text-muted-foreground">
                            {AUDIT_METADATA_LABELS[field]}
                          </dt>
                          <dd className="break-words">
                            {formatAuditValue(field, value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card density="compact" size="sm">
              <CardHeader className="border-b" density="compact">
                <CardTitle as="h2">Referências técnicas</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <dl className="grid gap-2 text-sm">
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">ID do evento</dt>
                    <dd className="type-code break-all">{log.id}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-muted-foreground">Código da ação</dt>
                    <dd className="type-code break-all">{log.action}</dd>
                  </div>
                  {log.targetId ? (
                    <div className="grid gap-1">
                      <dt className="text-muted-foreground">ID do registro</dt>
                      <dd className="type-code break-all">{log.targetId}</dd>
                    </div>
                  ) : null}
                </dl>
                {hasAdminAuditActionLabel(log.action) ? null : (
                  <p className="mt-4 text-muted-foreground text-xs">
                    Este código ainda não possui uma descrição amigável no
                    catálogo de auditoria.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
