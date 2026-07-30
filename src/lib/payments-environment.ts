export const PAYMENTS_CHECKOUT_MODES = [
  "disabled",
  "authenticated",
  "public",
] as const;

export type PaymentsCheckoutMode = (typeof PAYMENTS_CHECKOUT_MODES)[number];

export const isPaymentsCheckoutMode = (
  value: string
): value is PaymentsCheckoutMode =>
  PAYMENTS_CHECKOUT_MODES.some((mode) => mode === value);
