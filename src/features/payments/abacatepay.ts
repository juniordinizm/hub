export type OrderStatus = "pending" | "paid" | "refunded" | "ignored";

const COURSE_PRICE_INVALID_MESSAGE = "Preco do curso invalido.";
const DEFAULT_PAYMENT_METHODS = ["PIX", "CARD"] as const;

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

export interface AbacatePayProductRequest {
  currency: "BRL";
  description?: string;
  externalId: string;
  imageUrl?: string;
  name: string;
  price: number;
}

export interface AbacatePayCheckoutRequest {
  completionUrl: string;
  externalId: string;
  frequency: "ONE_TIME";
  items: Array<{
    id: string;
    quantity: number;
  }>;
  metadata: {
    courseId: string;
    userId: string;
  };
  methods: string[];
  returnUrl: string;
}

const paidEvents = new Set(["checkout.paid", "billing.paid"]);
const refundedEvents = new Set(["checkout.refunded", "transparent.refunded"]);
const DECIMAL_PRICE_RE = /^\d+(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:\.\d{1,2})?$/;
const THOUSANDS_ONLY_RE = /^\d{1,3}(?:\.\d{3})+$/;

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

export const parsePriceToCents = (value: string): number => {
  const normalized = value.replace(/[R$\s]/g, "").trim();

  if (!DECIMAL_PRICE_RE.test(normalized)) {
    throw new Error(COURSE_PRICE_INVALID_MESSAGE);
  }

  const decimalSeparator =
    normalized.includes(",") || THOUSANDS_ONLY_RE.test(normalized) ? "," : ".";
  const withoutThousands =
    decimalSeparator === ","
      ? normalized.replace(/\./g, "")
      : normalized.replace(/,/g, "");
  const [reais = "", cents = ""] = withoutThousands.split(decimalSeparator);
  const amountInCents =
    Number.parseInt(reais, 10) * 100 +
    Number.parseInt(cents.padEnd(2, "0").slice(0, 2) || "0", 10);

  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new Error(COURSE_PRICE_INVALID_MESSAGE);
  }

  return amountInCents;
};

export const formatCentsToBrl = (valueInCents: number): string =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueInCents / 100);

export const buildAbacatePayProductRequest = ({
  courseId,
  description,
  imageUrl,
  priceInCents,
  title,
}: {
  courseId: string;
  description: string | null;
  imageUrl: string | null;
  priceInCents: number;
  title: string;
}): AbacatePayProductRequest => {
  const request: AbacatePayProductRequest = {
    currency: "BRL",
    externalId: courseId,
    name: title,
    price: priceInCents,
  };

  if (description) {
    request.description = description;
  }

  if (imageUrl?.startsWith("http")) {
    request.imageUrl = imageUrl;
  }

  return request;
};

export const buildAbacatePayCheckoutRequest = ({
  completionUrl,
  courseId,
  externalId,
  productId,
  returnUrl,
  userId,
}: {
  completionUrl: string;
  courseId: string;
  externalId: string;
  productId: string;
  returnUrl: string;
  userId: string;
}): AbacatePayCheckoutRequest => ({
  completionUrl,
  externalId,
  frequency: "ONE_TIME",
  items: [{ id: productId, quantity: 1 }],
  metadata: {
    courseId,
    userId,
  },
  methods: [...DEFAULT_PAYMENT_METHODS],
  returnUrl,
});

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
