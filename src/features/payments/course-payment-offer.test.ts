import { describe, expect, it } from "vitest";
import {
  buildAsaasCheckoutPaymentOptions,
  DEFAULT_COURSE_PAYMENT_OFFER,
  parseCoursePaymentOffer,
} from "./course-payment-offer";

describe("course payment offer", () => {
  it("defaults new courses to Pix and card in up to three installments", () => {
    expect(DEFAULT_COURSE_PAYMENT_OFFER).toEqual({
      allowCreditCard: true,
      allowPix: true,
      maxInstallmentCount: 3,
    });
  });

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
  ] as const)("maps a valid offer to the Asaas Checkout contract", (offer, expected) => {
    expect(buildAsaasCheckoutPaymentOptions(offer)).toEqual(expected);
  });

  it("rejects an offer without a payment method", () => {
    expect(() =>
      parseCoursePaymentOffer({
        allowCreditCard: false,
        allowPix: false,
        maxInstallmentCount: 1,
      })
    ).toThrow("Selecione Pix, cartao ou ambos.");
  });

  it("normalizes the irrelevant installment limit for a Pix-only offer", () => {
    expect(
      parseCoursePaymentOffer({
        allowCreditCard: false,
        allowPix: true,
        maxInstallmentCount: 3,
      })
    ).toEqual({
      allowCreditCard: false,
      allowPix: true,
      maxInstallmentCount: 1,
    });
  });

  it.each([0, 1.5, 22])("rejects invalid installment limit %s", (limit) => {
    expect(() =>
      parseCoursePaymentOffer({
        allowCreditCard: true,
        allowPix: true,
        maxInstallmentCount: limit,
      })
    ).toThrow("Quantidade de parcelas deve estar entre 1 e 21.");
  });
});
