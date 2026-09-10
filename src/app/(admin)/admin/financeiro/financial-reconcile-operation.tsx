"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reconcileAsaasPaymentAction } from "@/features/payments/actions";
import { getErrorMessage } from "./financial-operations-shared";

export function ReconcilePaymentOperation({
  reviewId,
  orderId,
}: {
  orderId: string;
  reviewId?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const reconcile = async (formData: FormData): Promise<void> => {
    setError(null);
    setSuccessMessage(null);
    setPending(true);
    try {
      await reconcileAsaasPaymentAction(formData);
      setSuccessMessage(
        "Consulta concluída. O Pedido foi atualizado quando a evidência coincidiu."
      );
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
      {reviewId ? (
        <input name="reviewId" type="hidden" value={reviewId} />
      ) : null}
      <Button loading={pending} size="sm" type="submit" variant="outline">
        Conciliar pagamento
      </Button>
      {error ? (
        <p
          aria-live="assertive"
          className="mt-1 text-destructive text-xs"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p
          aria-live="polite"
          className="mt-1 text-success text-xs"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}
