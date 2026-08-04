import type { CreateAsaasPayment, CreatedAsaasPayment } from "./asaas";
import { AsaasGatewayError } from "./asaas-client";
import type { AsaasCustomerResolution } from "./asaas-customer-resolution";
import type { CourseCardPricingPolicy } from "./installment-pricing";
import type { PublicPurchaseBody } from "./public-purchase-api";

export interface PreparedInvoiceIntent {
  amountInCents: number;
  baseAmountInCents: number;
  cardPricingPolicy: CourseCardPricingPolicy;
  courseDescription: string;
  customerEmail: string;
  customerName: string;
  externalReference: string;
  installmentCount: number;
  orderId: string;
  paymentMethod: "credit_card" | "pix";
  surchargeAmountInCents: number;
}

export type InvoiceIntentPreparationErrorKind =
  | "conflict"
  | "identity_ineligible"
  | "quote_stale"
  | "temporarily_unavailable";

export class InvoiceIntentPreparationError extends Error {
  readonly kind: InvoiceIntentPreparationErrorKind;

  constructor(kind: InvoiceIntentPreparationErrorKind, message: string) {
    super(message);
    this.name = "InvoiceIntentPreparationError";
    this.kind = kind;
  }
}

export type InvoiceIntentResult =
  | { orderId: string; redirectUrl: string; status: "ready" }
  | { orderId: string; status: "failed" | "processing" };

export interface InvoiceIntentStore {
  claimCreating(orderId: string): Promise<boolean>;
  markFailed(orderId: string): Promise<void>;
  markReady(orderId: string, payment: CreatedAsaasPayment): Promise<boolean>;
  markUncertain(orderId: string): Promise<void>;
  prepare(
    input: PublicPurchaseBody
  ): Promise<
    | { intent: PreparedInvoiceIntent; status: "created" }
    | { result: InvoiceIntentResult; status: "duplicate" }
  >;
  setProviderCustomer(
    orderId: string,
    providerCustomerId: string
  ): Promise<void>;
}

export interface InvoicePaymentGateway {
  createPayment(input: CreateAsaasPayment): Promise<CreatedAsaasPayment>;
}

const nextSaoPauloCalendarDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  const next = new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day) + 1)
  );
  return next.toISOString().slice(0, 10);
};

export const createAsaasInvoiceIntent = async ({
  callbackUrl,
  gateway,
  input,
  now = () => new Date(),
  resolveCustomer,
  store,
}: {
  callbackUrl?: string;
  gateway: InvoicePaymentGateway;
  input: PublicPurchaseBody;
  now?: () => Date;
  resolveCustomer: () => Promise<AsaasCustomerResolution>;
  store: InvoiceIntentStore;
}): Promise<InvoiceIntentResult> => {
  const preparation = await store.prepare(input);
  if (preparation.status === "duplicate") {
    return preparation.result;
  }
  const { intent } = preparation;
  if (!(await store.claimCreating(intent.orderId))) {
    return { orderId: intent.orderId, status: "processing" };
  }

  let customer: AsaasCustomerResolution;
  try {
    customer = await resolveCustomer();
  } catch {
    await store.markFailed(intent.orderId);
    return { orderId: intent.orderId, status: "failed" };
  }
  if (customer.status === "processing") {
    await store.markFailed(intent.orderId);
    return { orderId: intent.orderId, status: "failed" };
  }
  await store.setProviderCustomer(intent.orderId, customer.providerCustomerId);

  try {
    const payment = await gateway.createPayment({
      billingType: intent.paymentMethod === "pix" ? "PIX" : "CREDIT_CARD",
      ...(callbackUrl
        ? { callback: { autoRedirect: true, successUrl: callbackUrl } }
        : {}),
      customerId: customer.providerCustomerId,
      description: intent.courseDescription,
      dueDate: nextSaoPauloCalendarDate(now()),
      externalReference: intent.externalReference,
      installmentCount: intent.installmentCount,
      totalAmountInCents: intent.amountInCents,
    });
    if (!(await store.markReady(intent.orderId, payment))) {
      await store.markUncertain(intent.orderId);
      return { orderId: intent.orderId, status: "processing" };
    }
    return {
      orderId: intent.orderId,
      redirectUrl: payment.invoiceUrl,
      status: "ready",
    };
  } catch (error) {
    if (error instanceof AsaasGatewayError && error.outcome === "rejected") {
      await store.markFailed(intent.orderId);
      return { orderId: intent.orderId, status: "failed" };
    }
    await store.markUncertain(intent.orderId);
    return { orderId: intent.orderId, status: "processing" };
  }
};
