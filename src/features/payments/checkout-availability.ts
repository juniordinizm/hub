export type CheckoutEntry = "authenticated" | "public";
export type PaymentsCheckoutMode = "authenticated" | "disabled" | "public";

export class CheckoutUnavailableError extends Error {
  constructor() {
    super("Checkout indisponivel.");
    this.name = "CheckoutUnavailableError";
  }
}

export const assertCheckoutAvailable = ({
  entry,
  mode,
}: {
  entry: CheckoutEntry;
  mode: PaymentsCheckoutMode;
}): void => {
  const allowed =
    mode === "public" ||
    (mode === "authenticated" && entry === "authenticated");

  if (!allowed) {
    throw new CheckoutUnavailableError();
  }
};
