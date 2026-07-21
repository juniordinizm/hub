import { PageContainer } from "@/components/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getAdminAuditData } from "@/features/admin/server";
import { requirePermission } from "@/lib/auth-permissions";
import { formatDate } from "@/lib/formatters";
import { OutboxDeadLetterReprocess } from "./outbox-dead-letters";

export const dynamic = "force-dynamic";

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
