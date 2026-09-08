"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DatePickerField } from "@/components/date-picker-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPaymentReviewStatusPresentation } from "@/features/admin/status-presentation";
import {
  confirmRefundPasswordAction,
  importAsaasStatementAction,
  reconcileAsaasPaymentAction,
  requestFullRefundAction,
  resolvePaymentReviewAction,
  retryFailedAsaasWebhookAction,
} from "@/features/payments/actions";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";

type PaymentReviewType =
  | "amount_mismatch"
  | "buyer_identity"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict"
  | "uncertain_result";

const PAYMENT_REVIEW_LABELS: Record<PaymentReviewType, string> = {
  amount_mismatch: "Divergência de valor",
  buyer_identity: "Identidade da compra requer suporte",
  event_anomaly: "Anomalia de evento",
  partial_refund: "Reembolso parcial",
  terminal_conflict: "Conflito terminal",
  uncertain_result: "Resultado incerto",
};

export function RefundOperation({
  orderId,
}: {
  orderId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [confirmationToken, setConfirmationToken] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const confirmPassword = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      const result = await confirmRefundPasswordAction(formData);
      setConfirmationToken(result.confirmationToken);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  const requestRefund = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await requestFullRefundAction(formData);
      setConfirmationToken(null);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="mt-3 rounded-md border bg-background p-3">
      <summary className="cursor-pointer font-medium text-sm">
        Solicitar estorno integral
      </summary>
      <p className="mt-2 text-muted-foreground text-xs">
        O acesso permanece ativo até a confirmação do webhook. O pedido deve ser
        confirmado digitando o identificador completo abaixo.
      </p>
      {confirmationToken ? (
        <form action={requestRefund} className="mt-3">
          <input
            name="confirmationToken"
            type="hidden"
            value={confirmationToken}
          />
          <input name="orderId" type="hidden" value={orderId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`refund-order-${orderId}`}>
                Confirme o pedido
              </FieldLabel>
              <Input
                autoComplete="off"
                className="font-mono text-xs"
                id={`refund-order-${orderId}`}
                name="typedOrderId"
                placeholder={orderId}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`refund-reason-${orderId}`}>
                Motivo
              </FieldLabel>
              <Textarea
                id={`refund-reason-${orderId}`}
                name="reason"
                required
              />
            </Field>
          </FieldGroup>
          <Button
            className="mt-3 w-full sm:w-auto"
            loading={pending}
            type="submit"
            variant="destructive"
          >
            Confirmar estorno integral
          </Button>
        </form>
      ) : (
        <form action={confirmPassword} className="mt-3">
          <input name="orderId" type="hidden" value={orderId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`refund-password-${orderId}`}>
                Sua senha atual
              </FieldLabel>
              <Input
                autoComplete="current-password"
                id={`refund-password-${orderId}`}
                name="password"
                required
                type="password"
              />
            </Field>
          </FieldGroup>
          <Button
            className="mt-3 w-full sm:w-auto"
            loading={pending}
            type="submit"
            variant="outline"
          >
            Confirmar senha
          </Button>
        </form>
      )}
      {error ? (
        <p
          aria-live="polite"
          className="mt-2 text-destructive text-sm"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </details>
  );
}

export function ReconcilePaymentOperation({
  orderId,
}: {
  orderId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reconcile = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await reconcileAsaasPaymentAction(formData);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <form action={reconcile} className="mt-2">
      <input name="orderId" type="hidden" value={orderId} />
      <Button loading={pending} size="sm" type="submit" variant="outline">
        Conciliar pagamento
      </Button>
      {error ? (
        <p aria-live="polite" className="mt-1 text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function ImportStatementOperation(): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const importStatement = async (formData: FormData): Promise<void> => {
    setMessage(null);
    setPending(true);
    try {
      const result = await importAsaasStatementAction(formData);
      const resumedMessage =
        result.resumedFromOffset > 0
          ? ` Retomado do cursor ${result.resumedFromOffset}.`
          : "";
      setMessage(
        `${result.inserted} movimentações inseridas e ${result.updated} atualizadas.${resumedMessage}`
      );
      router.refresh();
    } catch (caught) {
      setMessage(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <form action={importStatement} className="grid gap-3 sm:grid-cols-3">
      <Field>
        <FieldLabel htmlFor="statement-start-date">Data inicial</FieldLabel>
        <DatePickerField
          defaultValue=""
          id="statement-start-date"
          name="startDate"
          placeholder="Selecionar data"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="statement-finish-date">Data final</FieldLabel>
        <DatePickerField
          defaultValue=""
          id="statement-finish-date"
          name="finishDate"
          placeholder="Selecionar data"
        />
      </Field>
      <Button className="self-end" loading={pending} type="submit">
        Importar extrato
      </Button>
      {message ? (
        <p
          aria-live="polite"
          className="text-muted-foreground text-xs sm:col-span-3"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function PaymentReviewOperation({
  canManageFinancialReviews,
  review,
}: {
  canManageFinancialReviews: boolean;
  review: {
    id: string;
    orderId: string;
    providerCheckoutId: string | null;
    reason: string;
    status: "approved" | "pending" | "rejected";
    type: PaymentReviewType;
  };
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const statusPresentation = getPaymentReviewStatusPresentation(review.status);

  const resolve = async (formData: FormData): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await resolvePaymentReviewAction(formData);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  if (review.status === "pending" && review.type === "buyer_identity") {
    return (
      <article className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-sm">
            {PAYMENT_REVIEW_LABELS[review.type]}
          </p>
          <Badge variant={statusPresentation.variant}>
            {statusPresentation.label}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">{review.reason}</p>
        <p className="mt-2 font-mono text-xs">{review.providerCheckoutId}</p>
        <p className="mt-3 text-sm">
          Não libere ou transfira o acesso. Execute o reembolso integral.
        </p>
        <RefundOperation orderId={review.orderId} />
      </article>
    );
  }

  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm">
          {PAYMENT_REVIEW_LABELS[review.type]}
        </p>
        <Badge variant={statusPresentation.variant}>
          {statusPresentation.label}
        </Badge>
      </div>
      <p className="mt-1 text-muted-foreground text-xs">{review.reason}</p>
      <p className="mt-2 font-mono text-xs">{review.providerCheckoutId}</p>
      {review.status === "pending" &&
      canManageFinancialReviews &&
      (review.type === "amount_mismatch" ||
        review.type === "terminal_conflict") ? (
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
                  <SelectItem value="approved">Aprovar</SelectItem>
                  <SelectItem value="rejected">Rejeitar</SelectItem>
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
      ) : (
        <p className="mt-3 text-muted-foreground text-sm">
          {review.status === "pending"
            ? "Aguardando decisão de uma administradora."
            : `Revisão ${statusPresentation.label.toLowerCase()}.`}
        </p>
      )}
      {error ? (
        <p
          aria-live="polite"
          className="mt-2 text-destructive text-sm"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function RetryWebhookOperation({
  webhookEventId,
}: {
  webhookEventId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");

  const retry = async (): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      const data = new FormData();
      data.set("webhookEventId", webhookEventId);
      data.set("reason", reason);
      await retryFailedAsaasWebhookAction(data);
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 grid gap-2">
      <Field>
        <FieldLabel htmlFor={`retry-webhook-reason-${webhookEventId}`}>
          Motivo do reprocessamento
        </FieldLabel>
        <Input
          autoComplete="off"
          id={`retry-webhook-reason-${webhookEventId}`}
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </Field>
      <Button
        disabled={!reason.trim()}
        loading={pending}
        onClick={retry}
        size="sm"
        type="button"
        variant="outline"
      >
        Reprocessar webhook falho
      </Button>
      {error ? (
        <p
          aria-live="polite"
          className="mt-2 text-destructive text-sm"
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
