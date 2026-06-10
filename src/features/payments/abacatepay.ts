export type OrderStatus = "pending" | "paid" | "refunded" | "ignored";

interface AbacatePayCheckoutPayload {
  amount?: unknown;
  externalId?: unknown;
  id?: unknown;
  items?: unknown;
  methods?: unknown;
  paidAmount?: unknown;
  receiptUrl?: unknown;
}

interface AbacatePayCustomerPayload {
  email?: unknown;
  name?: unknown;
}

interface AbacatePayWebhookPayload {
  data?: {
    checkout?: AbacatePayCheckoutPayload;
    billing?: AbacatePayCheckoutPayload;
    transparent?: AbacatePayCheckoutPayload;
    customer?: AbacatePayCustomerPayload;
  };
  event?: unknown;
  id?: unknown;
}

export interface AbacatePayOrderPayload {
  amountInCents: number;
  customerEmail: string;
  customerName: string;
  externalId: string;
  paidAmountInCents: number | null;
  paymentMethod: string | null;
  providerOrderId: string;
  providerProductId: string | null;
  receiptUrl: string | null;
}

const paidEvents = new Set(["checkout.paid", "billing.paid"]);
const refundedEvents = new Set(["checkout.refunded", "transparent.refunded"]);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const mapAbacatePayEventToOrderStatus = (event: string): OrderStatus => {
  if (paidEvents.has(event)) {
    return "paid";
  }

  if (refundedEvents.has(event)) {
    return "refunded";
  }

  return "ignored";
};

export const getAbacatePayEventKey = (
  payload: AbacatePayWebhookPayload
): string => {
  if (isString(payload.id)) {
    return payload.id;
  }

  const event = isString(payload.event) ? payload.event : "unknown";
  const order =
    payload.data?.checkout ??
    payload.data?.billing ??
    payload.data?.transparent;
  const providerOrderId = isString(order?.id) ? order.id : "missing";

  return `${event}:${providerOrderId}`;
};

export const getAbacatePayOrderPayload = (
  payload: AbacatePayWebhookPayload
): AbacatePayOrderPayload | null => {
  const order =
    payload.data?.checkout ??
    payload.data?.billing ??
    payload.data?.transparent;
  const customer = payload.data?.customer;

  if (!(order && isString(order.id) && isString(order.externalId))) {
    return null;
  }

  if (!(customer && isString(customer.email) && isString(customer.name))) {
    return null;
  }

  const methods = Array.isArray(order.methods) ? order.methods : [];
  const firstMethod = methods.find(isString) ?? null;
  const rawItems = Array.isArray((order as { items?: unknown }).items)
    ? (order as { items: unknown[] }).items
    : [];
  const firstItem = rawItems.find(
    (item): item is { id: string } =>
      typeof item === "object" &&
      item !== null &&
      isString((item as { id?: unknown }).id)
  );

  return {
    providerOrderId: order.id,
    externalId: order.externalId,
    providerProductId: firstItem?.id ?? null,
    amountInCents: isNumber(order.amount) ? order.amount : 0,
    paidAmountInCents: isNumber(order.paidAmount) ? order.paidAmount : null,
    paymentMethod: firstMethod,
    receiptUrl: isString(order.receiptUrl) ? order.receiptUrl : null,
    customerEmail: customer.email,
    customerName: customer.name,
  };
};
