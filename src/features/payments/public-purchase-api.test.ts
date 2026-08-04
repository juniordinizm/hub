import { describe, expect, it } from "vitest";
import {
  parsePublicPurchaseBody,
  serializePublicPaymentQuote,
} from "./public-purchase-api";

const validBody = {
  courseSlug: "curso-publico",
  cpfCnpj: "390.533.447-05",
  email: "buyer@example.com",
  installmentCount: 3,
  name: "Compradora",
  paymentMethod: "credit_card",
  purchaseAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
  quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
};

describe("public purchase API contract", () => {
  it("parses the strict purchase body and keeps the document only in memory", () => {
    expect(parsePublicPurchaseBody(validBody)).toEqual({
      ...validBody,
      cpfCnpj: "39053344705",
    });
  });

  it.each([
    [{ ...validBody, extra: true }],
    [{ ...validBody, installmentCount: 1.5 }],
    [{ ...validBody, installmentCount: 13 }],
    [{ ...validBody, paymentMethod: "pix", installmentCount: 2 }],
    [{ ...validBody, cpfCnpj: "111.111.111-11" }],
  ])("rejects malformed or contradictory input", (value) => {
    expect(parsePublicPurchaseBody(value)).toBeNull();
  });

  it("rejects objects with an abnormal prototype", () => {
    const body = Object.assign(Object.create({ polluted: true }), validBody);

    expect(parsePublicPurchaseBody(body)).toBeNull();
  });

  it("does not expose internal fee or target-net fields in quote responses", () => {
    const response = serializePublicPaymentQuote({
      expiresAt: new Date("2026-08-03T15:30:00.000Z"),
      id: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
      options: {
        cardOptions: [
          {
            count: 3,
            feeAmountInCents: 396,
            feePercentageBasisPoints: 349,
            grossAmountInCents: 10_048,
            installmentAmountInCents: 3349,
            lastInstallmentAmountInCents: 3350,
            netAmountInCents: 9652,
            operationFeeInCents: 49,
            surchargeAmountInCents: 48,
            targetNetAmountInCents: 9652,
          },
        ],
        installmentsTemporarilyUnavailable: false,
        pix: { grossAmountInCents: 10_000 },
      },
    });

    expect(response).toEqual({
      cardOptions: [
        {
          count: 3,
          grossAmountInCents: 10_048,
          installmentAmountInCents: 3349,
          lastInstallmentAmountInCents: 3350,
          surchargeAmountInCents: 48,
        },
      ],
      expiresAt: "2026-08-03T15:30:00.000Z",
      installmentsTemporarilyUnavailable: false,
      pix: { grossAmountInCents: 10_000 },
      quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
    });
    expect(JSON.stringify(response)).not.toContain("fee");
    expect(JSON.stringify(response)).not.toContain("net");
  });
});
