"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { FinanceHelp } from "@/components/admin/finance-help";
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
import { getAdminOrderPaymentMethodLabel } from "@/features/admin/order-filters";
import type {
  AdminInstallmentPayment,
  AdminOrder,
} from "@/features/admin/server";
import {
  getCheckoutStatusPresentation,
  getOrderStatusPresentation,
  getProviderPaymentStatusPresentation,
  getProviderRefundStatusPresentation,
  getProviderRiskStatusPresentation,
  getRefundRequestStatusPresentation,
} from "@/features/admin/status-presentation";
import { getAdminInstallmentPaymentsAction } from "@/features/payments/actions";
import {
  formatCurrencyInCents,
  formatDateTime,
  formatShortDate,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ReconcilePaymentOperation } from "./financial-reconcile-operation";
import { RefundOperation } from "./financial-refund-operation";

const getCustomerLabel = (order: AdminOrder): string =>
  order.customerName ?? order.customerEmail ?? "Compradora não identificada";

const getInstallmentLabel = (order: AdminOrder): string => {
  if (order.paymentInstallmentCount && order.paymentInstallmentCount > 1) {
    return `Parcelado em ${order.paymentInstallmentCount}x`;
  }
  if (order.providerInstallmentId) {
    return "Parcelado (quantidade não disponível)";
  }
  if (!order.paymentMethod) {
    return "Não definido";
  }
  return getAdminOrderPaymentMethodLabel(order.paymentMethod) ===
    "Cartão de crédito"
    ? "À vista no cartão"
    : "À vista";
};

const getOrderValueLabel = (order: AdminOrder): string => {
  if (order.status === "paid") {
    return "Pago";
  }
  if (order.status === "refunded" || order.status === "disputed") {
    return "Recebido";
  }
  return order.paidAmountInCents === null ? "Pedido" : "Registrado";
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatProviderDate = (value: string | null): string => {
  if (!value) {
    return "Não informado";
  }
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
  return value;
};

const CONFIRMED_INSTALLMENT_STATUSES = new Set([
  "confirmed",
  "received",
  "received_in_cash",
]);
const REVERSED_INSTALLMENT_STATUSES = new Set([
  "deleted",
  "partially_refunded",
  "refunded",
]);

const getInstallmentScheduleSummary = (
  payments: AdminInstallmentPayment[]
): {
  confirmedCount: number;
  confirmedValueInCents: number;
  pendingCount: number;
  pendingValueInCents: number;
  reversedCount: number;
} => {
  let confirmedCount = 0;
  let confirmedValueInCents = 0;
  let pendingCount = 0;
  let pendingValueInCents = 0;
  let reversedCount = 0;

  for (const payment of payments) {
    const status = payment.status.trim().toLowerCase();
    if (REVERSED_INSTALLMENT_STATUSES.has(status)) {
      reversedCount += 1;
    } else if (CONFIRMED_INSTALLMENT_STATUSES.has(status)) {
      confirmedCount += 1;
      confirmedValueInCents += payment.valueInCents;
    } else {
      pendingCount += 1;
      pendingValueInCents += payment.valueInCents;
    }
  }

  return {
    confirmedCount,
    confirmedValueInCents,
    pendingCount,
    pendingValueInCents,
    reversedCount,
  };
};

const hasCheckoutEvidence = (order: AdminOrder): boolean =>
  order.checkoutAttemptCount > 0 ||
  Boolean(order.checkoutErrorMessage) ||
  Boolean(order.checkoutLastAttemptAt) ||
  Boolean(order.checkoutNextAttemptAt);

const hasProviderEvidence = (order: AdminOrder): boolean =>
  Boolean(
    order.providerCheckoutId ||
      order.providerPaymentId ||
      order.providerInstallmentId ||
      order.providerPaymentStatus ||
      order.providerRiskStatus
  );

const hasRefundEvidence = (order: AdminOrder): boolean =>
  Boolean(
    order.refundRequestStatus ||
      order.providerRefundStatus ||
      order.providerRefundCreatedAt ||
      order.providerRefundEndToEndId ||
      order.providerRefundReceiptUrl ||
      order.refundErrorCode ||
      order.refundRequestCreatedAt ||
      order.refundConfirmedAt ||
      order.refundedAmountInCents !== null
  );

function DetailItem({
  children,
  label,
  mono = false,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn("min-w-0 text-sm", mono && "break-all font-mono text-xs")}
        translate={mono ? "no" : undefined}
      >
        {children}
      </dd>
    </div>
  );
}

export function FinancialOrderTableRow({
  onOpen,
  open,
  order,
}: {
  onOpen: (trigger?: HTMLButtonElement) => void;
  open: boolean;
  order: AdminOrder;
}): React.JSX.Element {
  const customerLabel = getCustomerLabel(order);
  const orderStatus = getOrderStatusPresentation(order.status);

  return (
    <TableRow>
      <TableRowHeader className="min-w-[14rem]">
        <div className="min-w-0">
          <p className="truncate font-medium">{customerLabel}</p>
          {order.customerName && order.customerEmail ? (
            <p className="truncate text-muted-foreground text-xs">
              {order.customerEmail}
            </p>
          ) : null}
        </div>
      </TableRowHeader>
      <TableCell className="max-w-[18rem] align-top">
        <p className="truncate font-medium text-sm">{order.courseTitle}</p>
      </TableCell>
      <TableCell className="align-top">
        <Badge
          aria-label={`Status do pedido: ${orderStatus.label}`}
          variant={orderStatus.variant}
        >
          {orderStatus.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right align-top">
        <p className="whitespace-nowrap font-medium tabular-nums">
          {formatCurrencyInCents(
            order.paidAmountInCents ?? order.amountInCents
          )}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {getOrderValueLabel(order)}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap align-top text-muted-foreground text-xs">
        {formatShortDate(order.createdAt)}
      </TableCell>
      <TableCell className="text-right align-top">
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Abrir detalhes do pedido de ${customerLabel}`}
          onClick={(event) => {
            onOpen(event.currentTarget);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Detalhes
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-end"
            icon={ArrowRight01Icon}
            size={16}
            strokeWidth={2}
          />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OrderSummarySection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element {
  const orderStatus = getOrderStatusPresentation(order.status);
  const checkoutStatus = getCheckoutStatusPresentation(order.checkoutStatus);
  const paymentStatus = order.providerPaymentStatus
    ? getProviderPaymentStatusPresentation(order.providerPaymentStatus)
    : null;
  const refundStatus = order.refundRequestStatus
    ? getRefundRequestStatusPresentation(order.refundRequestStatus)
    : null;

  return (
    <section aria-labelledby={`order-summary-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-summary-${order.id}`}>
          Resumo
        </h3>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailItem label="Status do pedido">
          <Badge variant={orderStatus.variant}>{orderStatus.label}</Badge>
        </DetailItem>
        <DetailItem label="Curso">{order.courseTitle}</DetailItem>
        <DetailItem label="Checkout">
          <Badge variant={checkoutStatus.variant}>{checkoutStatus.label}</Badge>
        </DetailItem>
        <DetailItem label="Pagamento">
          {paymentStatus ? (
            <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
          ) : (
            "Pendente"
          )}
        </DetailItem>
        <DetailItem label="Método">
          {getAdminOrderPaymentMethodLabel(order.paymentMethod)}
        </DetailItem>
        <DetailItem label="Parcelamento">
          {getInstallmentLabel(order)}
        </DetailItem>
        <DetailItem label="Compradora">
          {order.customerEmail ?? "Não informado"}
        </DetailItem>
        <DetailItem label="Registrado em">
          {formatDateTime(order.createdAt)}
        </DetailItem>
        <DetailItem label="Pago em">
          {order.paidAt ? formatDateTime(order.paidAt) : "Aguardando pagamento"}
        </DetailItem>
        {refundStatus ? (
          <DetailItem label="Reembolso">{refundStatus.label}</DetailItem>
        ) : null}
      </dl>
    </section>
  );
}

function OrderValuesSection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element {
  return (
    <section aria-labelledby={`order-values-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-values-${order.id}`}>
          Valores
        </h3>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailItem label="Valor do pedido">
          {formatCurrencyInCents(order.amountInCents)}
        </DetailItem>
        <DetailItem label="Valor pago">
          {order.paidAmountInCents === null
            ? "Ainda não pago"
            : formatCurrencyInCents(order.paidAmountInCents)}
        </DetailItem>
        <DetailItem label="Valor líquido">
          {order.netAmountInCents === null
            ? "Não disponível"
            : formatCurrencyInCents(order.netAmountInCents)}
        </DetailItem>
        <DetailItem label="Tarifa Asaas">
          {order.feeAmountInCents === null
            ? "Não disponível"
            : formatCurrencyInCents(order.feeAmountInCents)}
        </DetailItem>
      </dl>
    </section>
  );
}

function InstallmentScheduleSection({
  canManageFinancialOperations,
  order,
}: {
  canManageFinancialOperations: boolean;
  order: AdminOrder;
}): React.JSX.Element {
  const [state, setState] = useState<
    | { attempt: number; kind: "loading"; payments: [] }
    | { kind: "error" | "empty"; payments: [] }
    | { kind: "ready"; payments: AdminInstallmentPayment[] }
  >({ attempt: 0, kind: "loading", payments: [] });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ attempt: retryCount, kind: "loading", payments: [] });
    getAdminInstallmentPaymentsAction(order.id)
      .then((payments) => {
        if (active) {
          setState(
            payments.length > 0
              ? { kind: "ready", payments }
              : { kind: "empty", payments: [] }
          );
        }
      })
      .catch(() => {
        if (active) {
          setState({ kind: "error", payments: [] });
        }
      });

    return () => {
      active = false;
    };
  }, [order.id, retryCount]);
  const scheduleSummary =
    state.kind === "ready"
      ? getInstallmentScheduleSummary(state.payments)
      : null;
  const loadingMessage =
    state.kind === "loading" && state.attempt > 0
      ? "Tentando consultar parcelas novamente…"
      : "Consultando parcelas salvas…";

  return (
    <section aria-labelledby={`order-installments-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3
          className="font-medium text-sm"
          id={`order-installments-${order.id}`}
        >
          Parcelas sincronizadas
        </h3>
      </div>
      <p className="mt-1 text-muted-foreground text-xs">
        O status abaixo é o status de cada cobrança no Asaas; não representa
        saldo disponível.
      </p>
      {state.kind === "loading" ? (
        <p aria-live="polite" className="mt-4 text-muted-foreground text-sm">
          {loadingMessage}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-destructive text-sm" role="alert">
            Não foi possível consultar as parcelas sincronizadas.
          </p>
          <Button
            onClick={() => setRetryCount((current) => current + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {state.kind === "empty" ? (
        <p className="mt-4 text-muted-foreground text-sm">
          Ainda não há parcelas sincronizadas.{" "}
          {canManageFinancialOperations
            ? "Use “Conciliar pagamento” para consultar o Asaas e atualizar este detalhe."
            : "Peça a uma administradora para conciliar o pagamento e atualizar este detalhe."}
        </p>
      ) : null}
      {state.kind === "ready" ? (
        <>
          {scheduleSummary ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <dt className="text-muted-foreground text-xs">
                  Confirmadas no Asaas
                </dt>
                <dd className="mt-1 font-medium text-sm tabular-nums">
                  {scheduleSummary.confirmedCount} ·{" "}
                  {formatCurrencyInCents(scheduleSummary.confirmedValueInCents)}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <dt className="text-muted-foreground text-xs">
                  Ainda não confirmadas
                </dt>
                <dd className="mt-1 font-medium text-sm tabular-nums">
                  {scheduleSummary.pendingCount} ·{" "}
                  {formatCurrencyInCents(scheduleSummary.pendingValueInCents)}
                </dd>
              </div>
              {scheduleSummary.reversedCount > 0 ? (
                <div className="rounded-lg bg-muted/30 p-3">
                  <dt className="text-muted-foreground text-xs">
                    Reembolsadas ou removidas
                  </dt>
                  <dd className="mt-1 font-medium text-sm tabular-nums">
                    {scheduleSummary.reversedCount}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {order.installmentPaymentsSyncedAt ? (
            <p className="mt-4 text-muted-foreground text-xs">
              Última sincronização:{" "}
              {formatDateTime(order.installmentPaymentsSyncedAt)}
            </p>
          ) : null}
          <div className="mt-3 rounded-lg border">
            <Table className="min-w-[560px]">
              <TableCaption className="sr-only">
                Cobranças individuais do parcelamento
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Parcela</TableHead>
                  <TableHead scope="col">Vencimento</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead className="text-right" scope="col">
                    Valor
                  </TableHead>
                  <TableHead scope="col">Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.payments.map((payment) => {
                  const status = getProviderPaymentStatusPresentation(
                    payment.status
                  );
                  return (
                    <TableRow key={payment.providerPaymentId}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {payment.installmentNumber
                          ? `${payment.installmentNumber}ª`
                          : "Não informada"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {formatProviderDate(payment.dueDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {payment.anticipated ? (
                            <span className="text-muted-foreground text-xs">
                              Antecipada
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        <p>{formatCurrencyInCents(payment.valueInCents)}</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {payment.netValueInCents === null
                            ? "Líquido não informado"
                            : `Líquido ${formatCurrencyInCents(payment.netValueInCents)}`}
                        </p>
                        {payment.feeAmountInCents === null ? null : (
                          <p className="text-muted-foreground text-xs">
                            Taxa{" "}
                            {formatCurrencyInCents(payment.feeAmountInCents)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {formatProviderDate(
                          payment.paymentDate ?? payment.clientPaymentDate
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function OrderProviderSection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element {
  const paymentStatus = order.providerPaymentStatus
    ? getProviderPaymentStatusPresentation(order.providerPaymentStatus)
    : null;
  const riskStatus = order.providerRiskStatus
    ? getProviderRiskStatusPresentation(order.providerRiskStatus)
    : null;

  return (
    <section aria-labelledby={`order-provider-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-provider-${order.id}`}>
          Integração Asaas
        </h3>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailItem label="ID do checkout" mono>
          {order.providerCheckoutId ?? "Não correlacionado"}
        </DetailItem>
        <DetailItem label="ID do pagamento" mono>
          {order.providerPaymentId ?? "Não correlacionado"}
        </DetailItem>
        <DetailItem label="ID do parcelamento" mono>
          {order.providerInstallmentId ?? "Não parcelado"}
        </DetailItem>
        <DetailItem label="Status no provedor">
          {paymentStatus ? (
            <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
          ) : (
            "Não informado"
          )}
        </DetailItem>
        {order.providerPaymentStatus ? (
          <DetailItem label="Código do status" mono>
            {order.providerPaymentStatus}
          </DetailItem>
        ) : null}
        {order.providerRiskStatus ? (
          <DetailItem label="Risco no provedor">
            {riskStatus ? (
              <Badge variant={riskStatus.variant}>{riskStatus.label}</Badge>
            ) : (
              "Status não informado"
            )}
          </DetailItem>
        ) : null}
        {order.providerRiskStatus ? (
          <DetailItem label="Código de risco" mono>
            {order.providerRiskStatus}
          </DetailItem>
        ) : null}
      </dl>
    </section>
  );
}

function OrderCheckoutEvidenceSection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element | null {
  const hasEvidence =
    order.checkoutAttemptCount > 0 ||
    Boolean(order.checkoutErrorMessage) ||
    Boolean(order.checkoutLastAttemptAt) ||
    Boolean(order.checkoutNextAttemptAt);

  if (!hasEvidence) {
    return null;
  }

  return (
    <section aria-labelledby={`order-checkout-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-checkout-${order.id}`}>
          Evidência do checkout
        </h3>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailItem label="Tentativas">
          <span className="tabular-nums">{order.checkoutAttemptCount}</span>
        </DetailItem>
        <DetailItem label="Última tentativa">
          {order.checkoutLastAttemptAt
            ? formatDateTime(order.checkoutLastAttemptAt)
            : "Nenhuma"}
        </DetailItem>
        <DetailItem label="Próxima tentativa">
          {order.checkoutNextAttemptAt
            ? formatDateTime(order.checkoutNextAttemptAt)
            : "Não agendada"}
        </DetailItem>
        {order.checkoutErrorMessage ? (
          <DetailItem label="Motivo registrado">
            {order.checkoutErrorMessage}
          </DetailItem>
        ) : null}
      </dl>
    </section>
  );
}

function OrderRefundEvidenceSection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element | null {
  if (!hasRefundEvidence(order)) {
    return null;
  }

  const status = order.refundRequestStatus
    ? getRefundRequestStatusPresentation(order.refundRequestStatus)
    : null;
  const providerStatus = order.providerRefundStatus
    ? getProviderRefundStatusPresentation(order.providerRefundStatus)
    : null;

  return (
    <section aria-labelledby={`order-refund-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-refund-${order.id}`}>
          Evidência do reembolso
        </h3>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {status ? (
          <DetailItem label="Status">
            <Badge variant={status.variant}>{status.label}</Badge>
          </DetailItem>
        ) : null}
        <DetailItem label="Valor devolvido">
          {order.refundedAmountInCents === null
            ? "Ainda não confirmado"
            : formatCurrencyInCents(order.refundedAmountInCents)}
        </DetailItem>
        <DetailItem label="Solicitado em">
          {order.refundRequestCreatedAt
            ? formatDateTime(order.refundRequestCreatedAt)
            : "Não registrado"}
        </DetailItem>
        <DetailItem label="Confirmado em">
          {order.refundConfirmedAt
            ? formatDateTime(order.refundConfirmedAt)
            : "Ainda não confirmado"}
        </DetailItem>
        {order.providerRefundStatus ? (
          <DetailItem label="Status no Asaas">
            {providerStatus ? (
              <Badge variant={providerStatus.variant}>
                {providerStatus.label}
              </Badge>
            ) : (
              "Não informado"
            )}
          </DetailItem>
        ) : null}
        {order.providerRefundStatus ? (
          <DetailItem label="Código do status" mono>
            {order.providerRefundStatus}
          </DetailItem>
        ) : null}
        {order.providerRefundCreatedAt ? (
          <DetailItem label="Criado no Asaas">
            {formatProviderDate(order.providerRefundCreatedAt)}
          </DetailItem>
        ) : null}
        {order.providerRefundEndToEndId ? (
          <DetailItem label="ID da transação" mono>
            {order.providerRefundEndToEndId}
          </DetailItem>
        ) : null}
        {order.refundErrorCode ? (
          <DetailItem label="Código técnico do reembolso" mono>
            {order.refundErrorCode}
          </DetailItem>
        ) : null}
      </dl>
      {order.providerRefundReceiptUrl ? (
        <Button asChild className="mt-4" size="sm" variant="outline">
          <a
            href={order.providerRefundReceiptUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Abrir comprovante
          </a>
        </Button>
      ) : null}
    </section>
  );
}

function OrderTechnicalDetailsSection({
  order,
}: {
  order: AdminOrder;
}): React.JSX.Element | null {
  const checkoutEvidence = hasCheckoutEvidence(order);
  const providerEvidence = hasProviderEvidence(order);
  const refundEvidence = hasRefundEvidence(order);

  if (!(checkoutEvidence || providerEvidence || refundEvidence)) {
    return null;
  }

  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer rounded-md font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Detalhes técnicos
      </summary>
      <div className="mt-4 flex flex-col gap-6">
        {checkoutEvidence ? (
          <OrderCheckoutEvidenceSection order={order} />
        ) : null}
        {checkoutEvidence && (providerEvidence || refundEvidence) ? (
          <Separator />
        ) : null}
        {providerEvidence ? <OrderProviderSection order={order} /> : null}
        {providerEvidence && refundEvidence ? <Separator /> : null}
        {refundEvidence ? <OrderRefundEvidenceSection order={order} /> : null}
      </div>
    </details>
  );
}

function OrderActionsSection({
  canManageFinancialOperations,
  hasPendingBuyerIdentityReview,
  order,
}: {
  canManageFinancialOperations: boolean;
  hasPendingBuyerIdentityReview: boolean;
  order: AdminOrder;
}): React.JSX.Element {
  const hasRefundAction =
    order.status === "paid" &&
    !hasPendingBuyerIdentityReview &&
    (!order.refundRequestStatus || order.refundRequestStatus === "failed");
  const hasReconcileAction =
    canManageFinancialOperations &&
    Boolean(order.providerPaymentId) &&
    !hasPendingBuyerIdentityReview;
  const hasAction =
    hasPendingBuyerIdentityReview || hasRefundAction || hasReconcileAction;

  return (
    <section aria-labelledby={`order-actions-${order.id}`}>
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-sm" id={`order-actions-${order.id}`}>
          Ações
        </h3>
        <FinanceHelp
          description="Operações que podem alterar o estado financeiro ou o acesso deste Pedido."
          details={[
            "Conciliação consulta o Asaas e só atualiza o Pedido quando as evidências forem compatíveis.",
            "Reembolso integral exige confirmação adicional e o acesso só é revogado quando o Asaas confirmar o reembolso.",
          ]}
          title="Ações do Pedido"
        />
      </div>
      <div className="mt-4 flex flex-col items-start gap-3">
        {hasPendingBuyerIdentityReview ? (
          <div className="flex flex-col gap-1">
            <Badge variant="secondary">Revisão de identidade pendente</Badge>
            <p className="text-muted-foreground text-xs">
              A decisão está disponível na fila de Pendências financeiras.
            </p>
          </div>
        ) : null}
        {hasRefundAction ? <RefundOperation orderId={order.id} /> : null}
        {hasReconcileAction ? (
          <div>
            <p className="text-muted-foreground text-xs">
              Consulta o Asaas e pode atualizar o status quando a evidência for
              compatível.
            </p>
            <ReconcilePaymentOperation orderId={order.id} />
          </div>
        ) : null}
        {hasAction ? null : (
          <p className="text-muted-foreground text-sm">
            Nenhuma ação disponível para este pedido.
          </p>
        )}
      </div>
    </section>
  );
}

function OrderDetailsBody({
  canManageFinancialOperations,
  hasPendingBuyerIdentityReview,
  order,
}: {
  canManageFinancialOperations: boolean;
  hasPendingBuyerIdentityReview: boolean;
  order: AdminOrder;
}): React.JSX.Element {
  return (
    <DialogBody className="overscroll-contain">
      <div className="flex flex-col gap-6">
        <OrderSummarySection order={order} />
        <Separator />
        <OrderValuesSection order={order} />
        <Separator />
        <OrderActionsSection
          canManageFinancialOperations={canManageFinancialOperations}
          hasPendingBuyerIdentityReview={hasPendingBuyerIdentityReview}
          order={order}
        />
        {order.providerInstallmentId ? (
          <>
            <Separator />
            <InstallmentScheduleSection
              canManageFinancialOperations={canManageFinancialOperations}
              order={order}
            />
          </>
        ) : null}
        <OrderTechnicalDetailsSection order={order} />
      </div>
    </DialogBody>
  );
}

export function FinancialOrderDetailsDialog({
  canManageFinancialOperations,
  hasPendingBuyerIdentityReview,
  onOpenChange,
  open,
  order,
  triggerRef,
}: {
  canManageFinancialOperations: boolean;
  hasPendingBuyerIdentityReview: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  order: AdminOrder;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  const customerLabel = getCustomerLabel(order);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Pedido de {customerLabel}</DialogTitle>
          <DialogDescription>
            {order.courseTitle} · Pedido {order.id}
          </DialogDescription>
        </DialogHeader>

        <OrderDetailsBody
          canManageFinancialOperations={canManageFinancialOperations}
          hasPendingBuyerIdentityReview={hasPendingBuyerIdentityReview}
          order={order}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
