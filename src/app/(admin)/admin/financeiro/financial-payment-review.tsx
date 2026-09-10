"use client";

import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminPaymentReview,
  AdminPaymentReviewHistory,
} from "@/features/admin/server";
import {
  getOrderStatusPresentation,
  getPaymentReviewStatusPresentation,
  getProviderPaymentStatusPresentation,
} from "@/features/admin/status-presentation";
import { resolvePaymentReviewAction } from "@/features/payments/actions";
import { formatCurrencyInCents, formatDateTime } from "@/lib/formatters";
import {
  BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE,
  getErrorMessage,
  getPaymentReviewReasonPresentation,
  getReviewOrderHref,
  getReviewSubject,
  PAYMENT_REVIEW_LABELS,
} from "./financial-operations-shared";
import { ReconcilePaymentOperation } from "./financial-reconcile-operation";
import { RefundOperation } from "./financial-refund-operation";

export function PaymentReviewHistorySheet({
  history,
  totalCount,
}: {
  history: AdminPaymentReviewHistory[];
  totalCount: number;
}): React.JSX.Element | null {
  if (history.length === 0 || totalCount === 0) {
    return null;
  }

  const historyDescription =
    totalCount > history.length
      ? `Mostrando as ${history.length} resoluções mais recentes de ${totalCount}.`
      : `${totalCount} resolução${totalCount === 1 ? "" : "ões"} registrada${totalCount === 1 ? "" : "s"}.`;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={HistoryIcon}
            size={18}
            strokeWidth={2}
          />
          Histórico ({totalCount})
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl"
        side="right"
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Histórico de revisões</SheetTitle>
          <SheetDescription>{historyDescription}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 overscroll-contain p-6">
          <div className="grid gap-4">
            {history.map((review) => {
              const statusPresentation = getPaymentReviewStatusPresentation(
                review.status
              );
              const reasonPresentation = getPaymentReviewReasonPresentation(
                review.reason,
                review.type
              );
              const headingId = `payment-review-history-${review.id}`;
              return (
                <article
                  aria-labelledby={headingId}
                  className="rounded-lg border p-4"
                  key={review.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm" id={headingId}>
                        {PAYMENT_REVIEW_LABELS[review.type]}
                      </h3>
                      <p className="mt-1 truncate text-muted-foreground text-xs">
                        {getReviewSubject(review)} · {review.courseTitle}
                      </p>
                    </div>
                    <Badge
                      className="shrink-0"
                      variant={statusPresentation.variant}
                    >
                      {statusPresentation.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <Link
                      className="font-mono underline underline-offset-4"
                      href={getReviewOrderHref(review.orderId)}
                    >
                      Pedido {review.orderId}
                    </Link>
                    <span>{formatCurrencyInCents(review.amountInCents)}</span>
                  </div>
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Motivo: </span>
                    {reasonPresentation.description}
                  </p>
                  <PaymentReviewTechnicalDetails
                    review={review}
                    technicalReason={reasonPresentation.technicalReason}
                  />
                  {review.decisionReason ? (
                    <p className="mt-2 text-sm">
                      Decisão: {review.decisionReason}
                    </p>
                  ) : null}
                  <p className="mt-2 text-muted-foreground text-xs">
                    Resolvida em{" "}
                    {review.resolvedAt
                      ? formatDateTime(review.resolvedAt)
                      : "data não registrada"}
                    {review.resolvedByEmail
                      ? ` · ${review.resolvedByEmail}`
                      : " · sem operador associado"}
                  </p>
                </article>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function PaymentReviewStatusContext({
  review,
}: {
  review: AdminPaymentReview;
}): React.JSX.Element {
  const orderStatus = getOrderStatusPresentation(review.orderStatus);
  const providerStatus = review.providerPaymentStatus
    ? getProviderPaymentStatusPresentation(review.providerPaymentStatus)
    : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <Link
        className="font-mono underline underline-offset-4"
        href={getReviewOrderHref(review.orderId)}
      >
        Pedido {review.orderId}
      </Link>
      <span className="inline-flex items-center gap-1">
        Pedido:
        <Badge variant={orderStatus.variant}>{orderStatus.label}</Badge>
      </span>
      {providerStatus ? (
        <span className="inline-flex items-center gap-1">
          Asaas:
          <Badge variant={providerStatus.variant}>{providerStatus.label}</Badge>
        </span>
      ) : null}
    </div>
  );
}

function PaymentReviewAmountComparison({
  review,
}: {
  review: AdminPaymentReview;
}): React.JSX.Element | null {
  if (review.type !== "amount_mismatch") {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg bg-muted/30 p-3">
      <p className="font-medium text-sm">Comparação de valores</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs">Snapshot do Pedido</dt>
          <dd className="mt-1 font-medium text-sm">
            {formatCurrencyInCents(review.amountInCents)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Valor observado</dt>
          <dd className="mt-1 font-medium text-sm">
            {getObservedAmountInCents(review) === null
              ? "Não disponível"
              : formatCurrencyInCents(getObservedAmountInCents(review) ?? 0)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const getObservedAmountInCents = (review: AdminPaymentReview): number | null =>
  review.observedAmountInCents ?? null;

function PaymentReviewTechnicalDetails({
  review,
  technicalReason,
}: {
  review: AdminPaymentReview;
  technicalReason: string;
}): React.JSX.Element {
  return (
    <details className="mt-3 rounded-md border border-dashed p-3">
      <summary className="cursor-pointer rounded-md font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Evidência técnica
      </summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">Motivo técnico</dt>
          <dd className="mt-1 break-all font-mono text-xs">
            {technicalReason}
          </dd>
        </div>
        {review.providerCheckoutId ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">
              ID do checkout Asaas
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {review.providerCheckoutId}
            </dd>
          </div>
        ) : null}
        {review.providerPaymentId ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">
              ID do pagamento Asaas
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {review.providerPaymentId}
            </dd>
          </div>
        ) : null}
        {review.providerPaymentStatus ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">
              Status bruto do Asaas
            </dt>
            <dd className="mt-1 break-all font-mono text-xs">
              {review.providerPaymentStatus}
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

const getReviewNextAction = ({
  canManageFinancialReviews,
  reasonInstruction,
  review,
}: {
  canManageFinancialReviews: boolean;
  reasonInstruction: string;
  review: AdminPaymentReview;
}): string | null => {
  if (review.status !== "pending") {
    return null;
  }
  if (review.type === "buyer_identity") {
    return `${BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE} Solicite o reembolso integral.`;
  }
  if (review.type === "amount_mismatch") {
    if (!canManageFinancialReviews) {
      return "Aguardando decisão de uma administradora.";
    }
    if (review.orderStatus !== "pending") {
      return "O Pedido já está em um estado não pendente. A decisão abaixo não altera o acesso atual.";
    }
    if (getObservedAmountInCents(review) === null) {
      return "Concilie o pagamento para registrar o valor observado antes de liberar o acesso.";
    }
  }
  return reasonInstruction;
};

export function PaymentReviewOperation({
  canManageFinancialReviews,
  canManageFinancialOperations,
  review,
}: {
  canManageFinancialReviews: boolean;
  canManageFinancialOperations: boolean;
  review: AdminPaymentReview;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const statusPresentation = getPaymentReviewStatusPresentation(review.status);
  const reasonPresentation = getPaymentReviewReasonPresentation(
    review.reason,
    review.type
  );
  const nextAction = getReviewNextAction({
    canManageFinancialReviews,
    reasonInstruction: reasonPresentation.instruction,
    review,
  });
  const headingId = `payment-review-${review.id}`;

  const resolve = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await resolvePaymentReviewAction(formData);
      toast.success("Decisão financeira registrada.");
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <article aria-labelledby={headingId} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-sm" id={headingId}>
            {PAYMENT_REVIEW_LABELS[review.type]}
          </h3>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {getReviewSubject(review)} · {review.courseTitle}
          </p>
        </div>
      </div>
      <PaymentReviewStatusContext review={review} />
      <PaymentReviewAmountComparison review={review} />
      <p className="mt-3 text-sm">
        <span className="font-medium">Motivo: </span>
        {reasonPresentation.description}
      </p>
      {nextAction ? (
        <p className="mt-2 text-muted-foreground text-sm">
          <span className="font-medium text-foreground">Próxima ação: </span>
          {nextAction}
        </p>
      ) : null}
      {review.status === "pending" && review.type === "buyer_identity" ? (
        <RefundOperation identityReview orderId={review.orderId} />
      ) : null}
      {review.status === "pending" &&
      canManageFinancialReviews &&
      review.type === "amount_mismatch" ? (
        <form action={resolve} className="mt-3">
          <input name="reviewId" type="hidden" value={review.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`review-decision-${review.id}`}>
                Decisão
              </FieldLabel>
              <Select defaultValue="" name="decision" required>
                <SelectTrigger id={`review-decision-${review.id}`}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {review.orderStatus === "pending" &&
                  getObservedAmountInCents(review) !== null ? (
                    <SelectItem value="approved">
                      Liberar e aceitar divergência
                    </SelectItem>
                  ) : null}
                  <SelectItem value="rejected">
                    {review.orderStatus === "pending"
                      ? "Manter acesso bloqueado"
                      : "Encerrar sem alterar o Pedido"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`review-reason-${review.id}`}>
                Motivo da decisão
              </FieldLabel>
              <Textarea
                id={`review-reason-${review.id}`}
                name="decisionReason"
                required
              />
            </Field>
          </FieldGroup>
          <Button
            className="mt-3 w-full sm:w-auto"
            loading={pending}
            type="submit"
            variant="outline"
          >
            Registrar decisão
          </Button>
        </form>
      ) : null}
      {review.status === "pending" &&
      review.type !== "buyer_identity" &&
      review.type !== "amount_mismatch" &&
      canManageFinancialOperations &&
      review.providerPaymentId ? (
        <ReconcilePaymentOperation
          orderId={review.orderId}
          reviewId={review.id}
        />
      ) : null}
      <PaymentReviewTechnicalDetails
        review={review}
        technicalReason={reasonPresentation.technicalReason}
      />
      {review.status === "pending" ? null : (
        <p className="mt-3 text-muted-foreground text-sm">
          Revisão {statusPresentation.label.toLowerCase()}.
        </p>
      )}
      {error ? (
        <p
          aria-live="assertive"
          className="mt-2 text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </article>
  );
}
