import { describe, expect, it } from "vitest";
import { buildAsaasCheckoutPaymentOptions } from "./asaas-checkout-options";

describe("Asaas checkout payment options", () => {
  it.each([
    [
      { allowCreditCard: false, allowPix: true, maxInstallmentCount: 1 },
      {
        billingTypes: ["PIX"],
        chargeTypes: ["DETACHED"],
      },
    ],
    [
      { allowCreditCard: true, allowPix: false, maxInstallmentCount: 1 },
      {
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED"],
      },
    ],
    [
      { allowCreditCard: true, allowPix: true, maxInstallmentCount: 3 },
      {
        billingTypes: ["PIX", "CREDIT_CARD"],
        chargeTypes: ["DETACHED", "INSTALLMENT"],
        installment: { maxInstallmentCount: 3 },
      },
    ],
  ] as const)("maps a valid offer to the provider contract", (offer, expected) => {
    expect(buildAsaasCheckoutPaymentOptions(offer)).toEqual(expected);
  });
});
