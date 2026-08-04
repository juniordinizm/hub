import type { AsaasInstallment, AsaasPayment } from "./asaas";
import type { InvoiceIntentResult } from "./invoice-intent";

export interface RecoverableInvoiceIntent {
  amountInCents: number;
  billingType: "CREDIT_CARD" | "PIX";
  externalReference: string;
  installmentCount: number;
  orderId: string;
  providerCustomerId: string;
}

interface InvoiceRecoveryGateway {
  getInstallment(installmentId: string): Promise<AsaasInstallment>;
  listPayments(input: {
    externalReference: string;
    limit: number;
  }): Promise<{ data: AsaasPayment[] }>;
}

interface RecoveredInvoice {
  installmentId: string | null;
  invoiceUrl: string;
  orderId: string;
  paymentId: string;
  providerStatus: string;
}

const matchesIntent = (
  payment: AsaasPayment,
  intent: RecoverableInvoiceIntent
): boolean =>
  payment.externalReference === intent.externalReference &&
  payment.customer === intent.providerCustomerId &&
  payment.billingType === intent.billingType;

export const recoverAsaasInvoice = async ({
  gateway,
  intent,
  markRecovered,
  markReview,
}: {
  gateway: InvoiceRecoveryGateway;
  intent: RecoverableInvoiceIntent;
  markRecovered: (input: RecoveredInvoice) => Promise<void>;
  markReview: (orderId: string) => Promise<void>;
}): Promise<InvoiceIntentResult> => {
  const listed = await gateway.listPayments({
    externalReference: intent.externalReference,
    limit: 100,
  });
  const candidates = listed.data.filter((payment) =>
    matchesIntent(payment, intent)
  );
  const effects = new Map<string, AsaasPayment[]>();
  for (const payment of candidates) {
    const effectId = payment.installmentId ?? payment.id;
    const group = effects.get(effectId) ?? [];
    group.push(payment);
    effects.set(effectId, group);
  }
  if (effects.size === 0) {
    return { orderId: intent.orderId, status: "processing" };
  }
  if (effects.size > 1) {
    await markReview(intent.orderId);
    return { orderId: intent.orderId, status: "processing" };
  }
  const group = effects.values().next().value as AsaasPayment[] | undefined;
  const payment =
    group?.find((candidate) => candidate.invoiceUrl) ?? group?.[0];
  if (!payment?.invoiceUrl) {
    return { orderId: intent.orderId, status: "processing" };
  }
  if (intent.installmentCount > 1) {
    if (!payment.installmentId) {
      await markReview(intent.orderId);
      return { orderId: intent.orderId, status: "processing" };
    }
    const installment = await gateway.getInstallment(payment.installmentId);
    if (
      installment.billingType !== intent.billingType ||
      installment.installmentCount !== intent.installmentCount ||
      installment.valueInCents !== intent.amountInCents
    ) {
      await markReview(intent.orderId);
      return { orderId: intent.orderId, status: "processing" };
    }
  } else if (payment.valueInCents !== intent.amountInCents) {
    await markReview(intent.orderId);
    return { orderId: intent.orderId, status: "processing" };
  }

  await markRecovered({
    installmentId: payment.installmentId ?? null,
    invoiceUrl: payment.invoiceUrl,
    orderId: intent.orderId,
    paymentId: payment.id,
    providerStatus: payment.status,
  });
  return {
    orderId: intent.orderId,
    redirectUrl: payment.invoiceUrl,
    status: "ready",
  };
};
