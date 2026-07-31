"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    : "Nao foi possivel concluir a operacao.";

type PaymentReviewType =
  | "amount_mismatch"
  | "buyer_identity"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict"
  | "uncertain_result";

const PAYMENT_REVIEW_LABELS: Record<PaymentReviewType, string> = {
  amount_mismatch: "Divergencia de valor",
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
        O acesso permanece ativo ate a confirmacao do webhook. O pedido deve ser
        confirmado digitando o identificador completo abaixo.
      </p>
      {confirmationToken ? (
        <form action={requestRefund} className="mt-3 grid gap-3">
          <input
            name="confirmationToken"
            type="hidden"
            value={confirmationToken}
          />
          <input name="orderId" type="hidden" value={orderId} />
          <div className="grid gap-1.5">
            <label htmlFor={`refund-order-${orderId}`}>Confirme o pedido</label>
            <input
              autoComplete="off"
              className="rounded-md border bg-background px-3 py-2 font-mono text-xs"
              id={`refund-order-${orderId}`}
              name="typedOrderId"
              placeholder={orderId}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`refund-reason-${orderId}`}>Motivo</label>
            <textarea
              className="min-h-20 rounded-md border bg-background px-3 py-2"
              id={`refund-reason-${orderId}`}
              name="reason"
              required
            />
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={pending}
            type="submit"
            variant="destructive"
          >
            {pending ? "Solicitando..." : "Confirmar estorno integral"}
          </Button>
        </form>
      ) : (
        <form action={confirmPassword} className="mt-3 grid gap-3">
          <input name="orderId" type="hidden" value={orderId} />
          <div className="grid gap-1.5">
            <label htmlFor={`refund-password-${orderId}`}>
              Sua senha atual
            </label>
            <input
              autoComplete="current-password"
              className="rounded-md border bg-background px-3 py-2"
              id={`refund-password-${orderId}`}
              name="password"
              required
              type="password"
            />
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={pending}
            type="submit"
            variant="outline"
          >
            {pending ? "Verificando..." : "Confirmar senha"}
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
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        {pending ? "Conciliando..." : "Conciliar pagamento"}
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
      setMessage(`${result.imported} movimentações importadas.`);
      router.refresh();
    } catch (caught) {
      setMessage(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };
  return (
    <form action={importStatement} className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-xs">
        Data inicial
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          name="startDate"
          required
          type="date"
        />
      </label>
      <label className="grid gap-1 text-xs">
        Data final
        <input
          className="rounded-md border bg-background px-3 py-2 text-sm"
          name="finishDate"
          required
          type="date"
        />
      </label>
      <Button className="self-end" disabled={pending} type="submit">
        {pending ? "Importando..." : "Importar extrato"}
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
  canResolveTerminalConflicts,
  review,
}: {
  canResolveTerminalConflicts: boolean;
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
        <p className="font-medium text-sm">
          {PAYMENT_REVIEW_LABELS[review.type]}
        </p>
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
      <p className="font-medium text-sm">
        {PAYMENT_REVIEW_LABELS[review.type]}
      </p>
      <p className="mt-1 text-muted-foreground text-xs">{review.reason}</p>
      <p className="mt-2 font-mono text-xs">{review.providerCheckoutId}</p>
      {review.status === "pending" &&
      (review.type === "amount_mismatch" ||
        (review.type === "terminal_conflict" &&
          canResolveTerminalConflicts)) ? (
        <form action={resolve} className="mt-3 grid gap-3">
          <input name="reviewId" type="hidden" value={review.id} />
          <div className="grid gap-1.5">
            <label htmlFor={`review-decision-${review.id}`}>Decisao</label>
            <select
              className="rounded-md border bg-background px-3 py-2"
              defaultValue=""
              id={`review-decision-${review.id}`}
              name="decision"
              required
            >
              <option disabled value="">
                Selecione
              </option>
              <option value="approved">Aprovar</option>
              <option value="rejected">Rejeitar</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`review-reason-${review.id}`}>
              Motivo da decisao
            </label>
            <textarea
              className="min-h-20 rounded-md border bg-background px-3 py-2"
              id={`review-reason-${review.id}`}
              name="decisionReason"
              required
            />
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={pending}
            type="submit"
            variant="outline"
          >
            {pending ? "Salvando..." : "Registrar decisao"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-muted-foreground text-sm">
          {review.status === "pending"
            ? "Aguardando decisao de uma administradora."
            : `Revisao ${review.status}.`}
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
      <label className="grid gap-1 text-xs">
        Motivo do reprocessamento
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </label>
      <Button
        disabled={pending || !reason.trim()}
        onClick={retry}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? "Reprocessando..." : "Reprocessar webhook falho"}
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
