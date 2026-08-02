import type { AsaasInstallment } from "./asaas";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getAsaasPaymentInstallmentId = (
  payload: unknown
): string | null => {
  if (!(isRecord(payload) && isRecord(payload.payment))) {
    return null;
  }
  const installmentId = payload.payment.installment;
  return typeof installmentId === "string" && installmentId.trim()
    ? installmentId
    : null;
};

const centsToDecimal = (valueInCents: number): number => valueInCents / 100;

export const materializeAsaasInstallmentPayload = ({
  installment,
  payload,
}: {
  installment: AsaasInstallment;
  payload: unknown;
}): unknown => {
  if (!(isRecord(payload) && isRecord(payload.payment))) {
    throw new Error("asaas_installment_payload_invalid");
  }
  const payment = payload.payment;
  if (
    payment.installment !== installment.id ||
    installment.checkoutSession === null ||
    (typeof payment.checkoutSession === "string" &&
      installment.checkoutSession !== payment.checkoutSession)
  ) {
    throw new Error("asaas_installment_correlation_invalid");
  }
  if (
    installment.billingType !== "CREDIT_CARD" ||
    installment.installmentCount < 2 ||
    installment.paymentValueInCents <= 0 ||
    installment.valueInCents <= 0 ||
    installment.netValueInCents < 0 ||
    installment.netValueInCents > installment.valueInCents
  ) {
    throw new Error("asaas_installment_contract_invalid");
  }

  return {
    ...payload,
    payment: {
      ...payment,
      billingType: installment.billingType,
      netValue: centsToDecimal(installment.netValueInCents),
      refunds: installment.refunds.map((refund) => ({
        dateCreated: refund.dateCreated,
        ...(refund.endToEndIdentifier
          ? { endToEndIdentifier: refund.endToEndIdentifier }
          : {}),
        status: refund.status,
        ...(refund.transactionReceiptUrl
          ? { transactionReceiptUrl: refund.transactionReceiptUrl }
          : {}),
        value: centsToDecimal(refund.valueInCents),
      })),
      value: centsToDecimal(installment.valueInCents),
    },
  };
};
