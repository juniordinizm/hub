import { parsePurchaseBuyerIdentity } from "./buyer-identity";
import type { PaymentQuoteRecord } from "./payment-quotes";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PURCHASE_KEYS = new Set([
  "courseSlug",
  "cpfCnpj",
  "email",
  "installmentCount",
  "name",
  "paymentMethod",
  "purchaseAttemptId",
  "quoteId",
]);

export interface PublicPurchaseBody {
  courseSlug: string;
  cpfCnpj: string;
  email: string;
  installmentCount: number;
  name: string;
  paymentMethod: "credit_card" | "pix";
  purchaseAttemptId: string;
  quoteId: string;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const parsePublicPurchaseBody = (
  value: unknown
): PublicPurchaseBody | null => {
  if (!isPlainRecord(value)) {
    return null;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== PURCHASE_KEYS.size ||
    keys.some((key) => !PURCHASE_KEYS.has(key))
  ) {
    return null;
  }
  const identity = parsePurchaseBuyerIdentity(value);
  const {
    courseSlug,
    installmentCount,
    paymentMethod,
    purchaseAttemptId,
    quoteId,
  } = value;
  if (
    !identity ||
    typeof courseSlug !== "string" ||
    courseSlug.length > 160 ||
    !COURSE_SLUG_PATTERN.test(courseSlug) ||
    typeof installmentCount !== "number" ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 12 ||
    (paymentMethod !== "credit_card" && paymentMethod !== "pix") ||
    (paymentMethod === "pix" && installmentCount !== 1) ||
    typeof purchaseAttemptId !== "string" ||
    !UUID_PATTERN.test(purchaseAttemptId) ||
    typeof quoteId !== "string" ||
    !UUID_PATTERN.test(quoteId)
  ) {
    return null;
  }
  return {
    courseSlug,
    cpfCnpj: identity.cpfCnpj,
    email: identity.email,
    installmentCount,
    name: identity.name,
    paymentMethod,
    purchaseAttemptId,
    quoteId,
  };
};

export const serializePublicPaymentQuote = (
  quote: Pick<PaymentQuoteRecord, "expiresAt" | "id" | "options">
) => ({
  cardOptions: quote.options.cardOptions.map((option) => ({
    count: option.count,
    grossAmountInCents: option.grossAmountInCents,
    installmentAmountInCents: option.installmentAmountInCents,
    lastInstallmentAmountInCents: option.lastInstallmentAmountInCents,
    surchargeAmountInCents: option.surchargeAmountInCents,
  })),
  expiresAt: quote.expiresAt.toISOString(),
  installmentsTemporarilyUnavailable:
    quote.options.installmentsTemporarilyUnavailable,
  pix: quote.options.pix,
  quoteId: quote.id,
});
