export type PersistedOrderStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "disputed"
  | "cancelled";

export interface OrderTransition {
  finalOrderStatus: PersistedOrderStatus;
  shouldApplyDisputeRevocation: boolean;
  shouldApplyPaidAccess: boolean;
  shouldApplyRefundRevocation: boolean;
}

export type PaymentReviewType = "amount_mismatch" | "terminal_conflict";

export interface PaymentReviewRequired {
  reason: string;
  type: PaymentReviewType;
}

const terminalOrderStatuses = new Set<PersistedOrderStatus>([
  "cancelled",
  "refunded",
  "disputed",
]);

export const resolveOrderStatus = ({
  currentStatus,
  incomingStatus,
}: {
  currentStatus: PersistedOrderStatus | null;
  incomingStatus: PersistedOrderStatus;
}): PersistedOrderStatus => {
  if (currentStatus && terminalOrderStatuses.has(currentStatus)) {
    return currentStatus;
  }

  if (currentStatus === "paid" && incomingStatus === "cancelled") {
    return currentStatus;
  }

  return incomingStatus;
};

export const getOrderTransition = ({
  currentStatus,
  incomingStatus,
}: {
  currentStatus: PersistedOrderStatus | null;
  incomingStatus: PersistedOrderStatus;
}): OrderTransition => {
  const finalOrderStatus = resolveOrderStatus({
    currentStatus,
    incomingStatus,
  });

  return {
    finalOrderStatus,
    shouldApplyPaidAccess:
      incomingStatus === "paid" &&
      finalOrderStatus === "paid" &&
      currentStatus !== "paid",
    shouldApplyRefundRevocation:
      incomingStatus === "refunded" &&
      finalOrderStatus === "refunded" &&
      currentStatus !== "refunded",
    shouldApplyDisputeRevocation:
      incomingStatus === "disputed" &&
      finalOrderStatus === "disputed" &&
      currentStatus !== "disputed",
  };
};

export const getPaymentReviewRequired = ({
  currentAmountInCents,
  currentStatus,
  incomingAmountInCents,
  incomingStatus,
}: {
  currentAmountInCents: number | null;
  currentStatus: PersistedOrderStatus | null;
  incomingAmountInCents: number;
  incomingStatus: PersistedOrderStatus;
}): PaymentReviewRequired | null => {
  if (
    currentStatus &&
    terminalOrderStatuses.has(currentStatus) &&
    incomingStatus !== currentStatus
  ) {
    return {
      type: "terminal_conflict",
      reason: `O pedido ja esta terminal em ${currentStatus}; evento posterior recebido como ${incomingStatus}.`,
    };
  }

  if (
    incomingStatus === "paid" &&
    (currentAmountInCents === null ||
      currentAmountInCents !== incomingAmountInCents)
  ) {
    return {
      type: "amount_mismatch",
      reason:
        currentAmountInCents === null
          ? "Pagamento recebido sem snapshot interno de checkout para validacao."
          : `Valor recebido (${incomingAmountInCents}) diverge do snapshot do checkout (${currentAmountInCents}).`,
    };
  }

  return null;
};
