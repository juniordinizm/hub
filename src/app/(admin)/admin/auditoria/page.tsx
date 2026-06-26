import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getAdminManagementData } from "@/features/admin/server";
import { formatDate } from "@/lib/formatters";

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
  const data = await getAdminManagementData();

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
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
    </main>
  );
}
