import type { AsaasRefundEvidence } from "./asaas";

const CANCELLED_REFUND_STATUS = "CANCELLED";
const COMPLETED_REFUND_STATUS = "DONE";

export const findExactAsaasRefundEvidence = (
  refunds: readonly AsaasRefundEvidence[],
  expectedAmountInCents: number
): AsaasRefundEvidence | null => {
  const hasInvalidEvidence = refunds.some(
    (refund) =>
      refund.valueInCents <= 0 || refund.status === CANCELLED_REFUND_STATUS
  );
  if (hasInvalidEvidence) {
    return null;
  }

  const firstRefund = refunds[0];
  const refundedAmountInCents = refunds.reduce(
    (total, refund) => total + refund.valueInCents,
    0
  );
  if (
    !(firstRefund && Number.isSafeInteger(refundedAmountInCents)) ||
    refundedAmountInCents !== expectedAmountInCents
  ) {
    return null;
  }
  if (refunds.length === 1) {
    return firstRefund;
  }

  return {
    dateCreated: firstRefund.dateCreated,
    status: refunds.every((refund) => refund.status === COMPLETED_REFUND_STATUS)
      ? COMPLETED_REFUND_STATUS
      : "PENDING",
    valueInCents: refundedAmountInCents,
  };
};
