"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmRefundPasswordAction,
  requestFullRefundAction,
} from "@/features/payments/actions";
import {
  BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE,
  getErrorMessage,
  REFUND_ASAAS_CONFIRMATION_MESSAGE,
} from "./financial-operations-shared";

export function RefundOperation({
  identityReview = false,
  orderId,
}: {
  identityReview?: boolean;
  orderId: string;
}): React.JSX.Element {
  const router = useRouter();
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (confirmationToken) {
      confirmationInputRef.current?.focus();
    }
  }, [confirmationToken]);

  const confirmPassword = async (formData: FormData): Promise<void> => {
    setError(null);
    setSuccessMessage(null);
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
    setSuccessMessage(null);
    setPending(true);
    try {
      await requestFullRefundAction(formData);
      setConfirmationToken(null);
      setSuccessMessage(
        `Solicitação de reembolso registrada. ${REFUND_ASAAS_CONFIRMATION_MESSAGE}`
      );
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="mt-3 rounded-md border bg-background p-3">
      <summary className="cursor-pointer rounded-md font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Solicitar reembolso integral
      </summary>
      {confirmationToken ? (
        <>
          <p aria-live="polite" className="mt-2 text-sm" role="status">
            Senha confirmada. A etapa 2 de 2 está pronta para preenchimento.
          </p>
          <form
            action={requestRefund}
            aria-describedby={`refund-step-two-description-${orderId}`}
            aria-labelledby={`refund-step-two-${orderId}`}
            className="mt-3"
          >
            <h4
              className="font-medium text-sm"
              id={`refund-step-two-${orderId}`}
            >
              Etapa 2 de 2: confirmar a solicitação
            </h4>
            <p
              className="mt-2 text-muted-foreground text-xs"
              id={`refund-step-two-description-${orderId}`}
            >
              {identityReview
                ? `Confirme o ID do Pedido e informe o motivo. ${BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE}`
                : `Confirme o ID do Pedido e informe o motivo. ${REFUND_ASAAS_CONFIRMATION_MESSAGE}`}
            </p>
            <input
              name="confirmationToken"
              type="hidden"
              value={confirmationToken}
            />
            <input name="orderId" type="hidden" value={orderId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`refund-order-${orderId}`}>
                  ID do Pedido
                </FieldLabel>
                <Input
                  autoComplete="off"
                  className="font-mono text-xs"
                  id={`refund-order-${orderId}`}
                  name="typedOrderId"
                  placeholder="Cole o ID completo…"
                  ref={confirmationInputRef}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`refund-reason-${orderId}`}>
                  Motivo da solicitação
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
              Confirmar solicitação de reembolso
            </Button>
          </form>
        </>
      ) : (
        <form
          action={confirmPassword}
          aria-describedby={`refund-step-one-description-${orderId}`}
          aria-labelledby={`refund-step-one-${orderId}`}
          className="mt-3"
        >
          <h4 className="font-medium text-sm" id={`refund-step-one-${orderId}`}>
            Etapa 1 de 2: confirmar a senha
          </h4>
          <p
            className="mt-2 text-muted-foreground text-xs"
            id={`refund-step-one-description-${orderId}`}
          >
            {identityReview
              ? `Confirme sua senha atual para autorizar a solicitação. ${BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE}`
              : "Confirme sua senha atual para autorizar a solicitação de reembolso."}
          </p>
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
          aria-live="assertive"
          className="mt-2 text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p
          aria-live="polite"
          className="mt-2 text-sm text-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
    </details>
  );
}
