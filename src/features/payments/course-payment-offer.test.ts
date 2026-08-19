import { describe, expect, it } from "vitest";
import {
  DEFAULT_COURSE_PAYMENT_OFFER,
  getEffectiveMaxInstallmentCount,
  MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS,
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

  it.each([0, 1.5, 13])("rejects invalid installment limit %s", (limit) => {
    expect(() =>
      parseCoursePaymentOffer({
        allowCreditCard: true,
        allowPix: true,
        maxInstallmentCount: limit,
      })
    ).toThrow("Quantidade de parcelas deve estar entre 1 e 12.");
  });

  it("uses the approved ten-real minimum per installment", () => {
    expect(MINIMUM_COURSE_INSTALLMENT_AMOUNT_IN_CENTS).toBe(1000);
    expect(
      getEffectiveMaxInstallmentCount({
        configuredMaxInstallmentCount: 3,
        priceInCents: 3000,
      })
    ).toBe(3);
  });

  it("reduces the effective limit without changing the configured default", () => {
    expect(
      getEffectiveMaxInstallmentCount({
        configuredMaxInstallmentCount: 3,
        priceInCents: 1990,
      })
    ).toBe(1);
    expect(DEFAULT_COURSE_PAYMENT_OFFER.maxInstallmentCount).toBe(3);
  });

  it("never exceeds the twelve-installment product maximum", () => {
    expect(
      getEffectiveMaxInstallmentCount({
        configuredMaxInstallmentCount: 21,
        priceInCents: 30_000,
      })
    ).toBe(12);
  });
});
