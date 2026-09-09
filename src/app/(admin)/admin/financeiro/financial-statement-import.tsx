"use client";

import {
  HistoryIcon,
  MoreHorizontalIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateRangePickerField } from "@/components/date-range-picker-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type {
  AdminStatementImportHistory,
  AdminStatementImportProgress,
} from "@/features/admin/server";
import { importAsaasStatementAction } from "@/features/payments/actions";
import { formatDateInput, formatDateTime } from "@/lib/formatters";
import {
  formatStatementDate,
  getErrorMessage,
} from "./financial-operations-shared";

export function StatementImportHistory({
  history,
}: {
  history: AdminStatementImportHistory[];
}): React.JSX.Element {
  return (
    <section aria-labelledby="statement-import-history" className="grid gap-3">
      <div className="flex items-start gap-3">
        <HugeiconsIcon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-muted-foreground"
          icon={HistoryIcon}
          size={18}
          strokeWidth={2}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="type-card-title" id="statement-import-history">
              Últimas sincronizações
            </h3>
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            Apenas sincronizações concluídas ficam registradas aqui.
          </p>
        </div>
      </div>
      {history.length ? (
        <div className="grid gap-3">
          {history.map((item, index) => (
            <div
              key={`${item.startDate}:${item.finishDate}:${item.completedAt.toISOString()}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {formatStatementDate(item.startDate)} a{" "}
                    {formatStatementDate(item.finishDate)}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {item.inserted} inseridas · {item.updated} atualizadas
                  </p>
                </div>
                <Badge className="shrink-0" variant="secondary">
                  Concluída
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground text-xs">
                {formatDateTime(item.completedAt)}
                {item.actorEmail ? ` · ${item.actorEmail}` : ""}
                {item.resumedFromOffset > 0
                  ? ` · retomada do cursor ${item.resumedFromOffset}`
                  : ""}
              </p>
              {index < history.length - 1 ? (
                <Separator className="mt-3" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhuma sincronização concluída ainda.
        </p>
      )}
    </section>
  );
}

export function FinancialOperationsMenu({
  statementImportHistory,
  statementImportProgress,
}: {
  statementImportHistory: AdminStatementImportHistory[];
  statementImportProgress: AdminStatementImportProgress | null;
}): React.JSX.Element {
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={MoreHorizontalIcon}
              size={18}
              strokeWidth={2}
            />
            Ações financeiras
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ferramentas financeiras</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setStatementDialogOpen(true)}>
              <HugeiconsIcon
                aria-hidden="true"
                icon={RefreshIcon}
                strokeWidth={2}
              />
              Sincronizar Asaas
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setStatementDialogOpen} open={statementDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sincronizar Asaas</DialogTitle>
            <DialogDescription>
              Sincronize as movimentações do Asaas de um período fechado para
              consulta e auditoria local. Repetir o período atualiza registros
              existentes e não cria duplicatas.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6 overscroll-contain">
            {statementImportProgress ? (
              <Alert variant="info">
                <AlertTitle>Sincronização em andamento</AlertTitle>
                <AlertDescription>
                  O período de{" "}
                  {formatStatementDate(statementImportProgress.startDate)} a{" "}
                  {formatStatementDate(statementImportProgress.finishDate)} será
                  retomado a partir do cursor{" "}
                  {statementImportProgress.nextOffset}.
                </AlertDescription>
              </Alert>
            ) : null}
            <Alert variant="info">
              <AlertTitle>Sincronização de consulta</AlertTitle>
              <AlertDescription>
                Esta ação não altera pedidos, pagamentos ou acessos. Para
                investigar uma compra específica, use a conciliação do pedido.
              </AlertDescription>
            </Alert>
            <SyncStatementOperation />
            <Separator />
            <StatementImportHistory history={statementImportHistory} />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SyncStatementOperation(): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const syncStatement = async (formData: FormData): Promise<void> => {
    setError(null);
    setSuccessMessage(null);
    setPending(true);
    try {
      const result = await importAsaasStatementAction(formData);
      const resumedMessage =
        result.resumedFromOffset > 0
          ? ` Retomado do cursor ${result.resumedFromOffset}.`
          : "";
      setSuccessMessage(
        `Sincronização concluída: ${result.inserted} movimentações inseridas e ${result.updated} atualizadas.${resumedMessage}`
      );
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      action={syncStatement}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <Field>
        <FieldLabel htmlFor="statement-date-range">
          Período das movimentações
        </FieldLabel>
        <DateRangePickerField
          endName="finishDate"
          id="statement-date-range"
          maxDate={formatDateInput(new Date())}
          placeholder="Selecionar período"
          startName="startDate"
        />
      </Field>
      <Button className="self-end" loading={pending} type="submit">
        Sincronizar
      </Button>
      {successMessage ? (
        <p
          aria-live="polite"
          className="text-muted-foreground text-xs sm:col-span-2"
        >
          {successMessage}
        </p>
      ) : null}
      {error ? (
        <p
          aria-live="assertive"
          className="text-destructive text-xs sm:col-span-2"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
