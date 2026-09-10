import { getOrderStatusPresentation } from "./status-presentation";

export const ADMIN_ORDER_STATUS_FILTERS = [
  "pending",
  "paid",
  "refunded",
  "disputed",
  "cancelled",
] as const;

export type AdminOrderStatusFilter =
  (typeof ADMIN_ORDER_STATUS_FILTERS)[number];

export const ADMIN_ORDER_CHECKOUT_FILTERS = [
  { label: "Em aberto", value: "open" },
  { label: "Encerrado", value: "closed" },
] as const;

export type AdminOrderCheckoutFilter =
  (typeof ADMIN_ORDER_CHECKOUT_FILTERS)[number]["value"];

export const ADMIN_ORDER_PAYMENT_METHOD_FILTERS = [
  { label: "Pix", value: "PIX" },
  { label: "Cartão de crédito", value: "CREDIT_CARD" },
  { label: "Não identificado", value: "UNKNOWN" },
  { label: "Outro", value: "OTHER" },
] as const;

export type AdminOrderPaymentMethodFilter =
  (typeof ADMIN_ORDER_PAYMENT_METHOD_FILTERS)[number]["value"];

export const isAdminOrderStatusFilter = (
  value: string
): value is AdminOrderStatusFilter =>
  ADMIN_ORDER_STATUS_FILTERS.includes(value as AdminOrderStatusFilter);

export const isAdminOrderCheckoutFilter = (
  value: string
): value is AdminOrderCheckoutFilter =>
  ADMIN_ORDER_CHECKOUT_FILTERS.some((option) => option.value === value);

export const isAdminOrderPaymentMethodFilter = (
  value: string
): value is AdminOrderPaymentMethodFilter =>
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS.some((option) => option.value === value);

export const getAdminOrderStatusFilterLabel = (
  value: AdminOrderStatusFilter
): string => getOrderStatusPresentation(value).label;

export const getAdminOrderPaymentMethodFilterLabel = (
  value: AdminOrderPaymentMethodFilter
): string =>
  ADMIN_ORDER_PAYMENT_METHOD_FILTERS.find((option) => option.value === value)
    ?.label ?? "Outro";

export const getAdminOrderCheckoutFilterLabel = (
  value: AdminOrderCheckoutFilter
): string =>
  ADMIN_ORDER_CHECKOUT_FILTERS.find((option) => option.value === value)
    ?.label ?? "Checkout";

export const getAdminOrderPaymentMethodLabel = (
  value: string | null
): string => {
  if (!value?.trim()) {
    return "Método pendente";
  }
  const normalizedValue = value.trim().toUpperCase();
  if (normalizedValue === "PIX") {
    return "Pix";
  }
  if (normalizedValue === "CREDIT_CARD") {
    return "Cartão de crédito";
  }
  if (normalizedValue === "BOLETO") {
    return "Boleto";
  }
  return value;
};
