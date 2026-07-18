import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeBuyerEmail } from "@/features/payments/buyer-identity";

export type PersistedOrderStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "disputed"
  | "cancelled";
export type OrderStatus = PersistedOrderStatus | "ignored";
export interface AbacatePayOrderTransition {
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

const ABACATEPAY_WEBHOOK_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";
const COURSE_PRICE_INVALID_MESSAGE = "Preco do curso invalido.";
const DEFAULT_PAYMENT_METHODS = ["PIX", "CARD"] as const;

interface AbacatePayCheckoutPayload {
  amount?: unknown;
  externalId?: unknown;
  id?: unknown;
  items?: unknown;
  metadata?: unknown;
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
  courseId: string | null;
  customerEmail: string;
  customerName: string;
  externalId: string;
  paidAmountInCents: number | null;
  paymentMethod: string | null;
  providerOrderId: string;
  providerProductId: string | null;
  receiptUrl: string | null;
  source: string | null;
  userId: string | null;
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
    accessDurationMonths: number;
    courseId: string;
    source?: string;
    userId?: string;
  };
  methods: string[];
  returnUrl: string;
}

const paidEvents = new Set([
  "checkout.completed",
  "checkout.paid",
  "billing.paid",
]);
const refundedEvents = new Set(["checkout.refunded", "transparent.refunded"]);
const disputedEvents = new Set(["checkout.disputed"]);
const cancelledEvents = new Set(["checkout.cancelled"]);
const terminalOrderStatuses = new Set<PersistedOrderStatus>([
  "cancelled",
  "refunded",
  "disputed",
]);
const DECIMAL_PRICE_RE = /^\d+(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:\.\d{1,2})?$/;
const THOUSANDS_ONLY_RE = /^\d{1,3}(?:\.\d{3})+$/;

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const timingSafeStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const getLegacySignatureParts = (
  signature: string
): { hash: string; timestamp: string } | null => {
  const parts = new Map(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value] as const;
    })
  );
  const timestamp = parts.get("t");
  const hash = parts.get("v1");

  return timestamp && hash ? { hash, timestamp } : null;
};

export const verifyAbacatePayWebhookSecret = ({
  expectedSecret,
  isProduction,
  receivedSecret,
}: {
  expectedSecret: string | undefined;
  isProduction: boolean;
  receivedSecret: string | null;
}): boolean => {
  if (!expectedSecret) {
    return !isProduction;
  }

  return (
    typeof receivedSecret === "string" &&
    timingSafeStringEqual(receivedSecret, expectedSecret)
  );
};

export const verifyAbacatePaySignature = ({
  legacySecret,
  payload,
  signature,
}: {
  legacySecret: string | undefined;
  payload: string;
  signature: string | null;
}): boolean => {
  if (!signature) {
    return false;
  }

  const legacyParts = getLegacySignatureParts(signature);

  if (legacyParts) {
    if (!legacySecret) {
      return false;
    }

    const expected = createHmac("sha256", legacySecret)
      .update(`${legacyParts.timestamp}.${payload}`)
      .digest("hex");

    return timingSafeStringEqual(legacyParts.hash, expected);
  }

  const expected = createHmac("sha256", ABACATEPAY_WEBHOOK_PUBLIC_HMAC_KEY)
    .update(Buffer.from(payload, "utf8"))
    .digest("base64");

  return timingSafeStringEqual(signature, expected);
};

export const parseAbacatePayWebhookPayload = (
  rawBody: string
): Record<string, unknown> | null => {
  try {
    const payload: unknown = JSON.parse(rawBody);

    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const mapAbacatePayEventToOrderStatus = (event: string): OrderStatus => {
  if (paidEvents.has(event)) {
    return "paid";
  }

  if (refundedEvents.has(event)) {
    return "refunded";
  }

  if (disputedEvents.has(event)) {
    return "disputed";
  }

  if (cancelledEvents.has(event)) {
    return "cancelled";
  }

  return "ignored";
};

export const resolveAbacatePayOrderStatus = ({
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

export const getAbacatePayOrderTransition = ({
  currentStatus,
  incomingStatus,
}: {
  currentStatus: PersistedOrderStatus | null;
  incomingStatus: PersistedOrderStatus;
}): AbacatePayOrderTransition => {
  const finalOrderStatus = resolveAbacatePayOrderStatus({
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
  accessDurationMonths,
  completionUrl,
  courseId,
  externalId,
  productId,
  returnUrl,
  source,
  userId,
}: {
  accessDurationMonths: number;
  completionUrl: string;
  courseId: string;
  externalId: string;
  productId: string;
  returnUrl: string;
  source?: string;
  userId?: string;
}): AbacatePayCheckoutRequest => {
  const metadata: AbacatePayCheckoutRequest["metadata"] = {
    accessDurationMonths,
    courseId,
  };

  if (userId) {
    metadata.userId = userId;
  }

  if (source) {
    metadata.source = source;
  }

  return {
    completionUrl,
    externalId,
    frequency: "ONE_TIME",
    items: [{ id: productId, quantity: 1 }],
    metadata,
    methods: [...DEFAULT_PAYMENT_METHODS],
    returnUrl,
  };
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
  const metadata =
    typeof order.metadata === "object" && order.metadata !== null
      ? (order.metadata as {
          courseId?: unknown;
          source?: unknown;
          userId?: unknown;
        })
      : null;
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
    customerEmail: normalizeBuyerEmail(customer.email),
    customerName: customer.name,
    courseId: isString(metadata?.courseId) ? metadata.courseId : null,
    source: isString(metadata?.source) ? metadata.source : null,
    userId: isString(metadata?.userId) ? metadata.userId : null,
  };
};
