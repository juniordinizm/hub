import { describe, expect, it } from "vitest";
import {
  chooseMinimumGrossAmount,
  createInstallmentSchedule,
  resolveContractedAmount,
  resolveSurchargeAmount,
} from "./installment-pricing";

describe("installment pricing", () => {
  it("chooses the smallest gross amount that preserves the target net", () => {
    expect(
      chooseMinimumGrossAmount({
        candidates: [10_049, 10_047, 10_048],
        netByGrossAmount: new Map([
          [10_047, 9651],
          [10_048, 9652],
          [10_049, 9653],
        ]),
        targetNetAmountInCents: 9652,
      })
    ).toBe(10_048);
  });

  it("returns null when no candidate preserves the target net", () => {
    expect(
      chooseMinimumGrossAmount({
        candidates: [10_047],
        netByGrossAmount: new Map([[10_047, 9651]]),
        targetNetAmountInCents: 9652,
      })
    ).toBeNull();
  });

  it("never adds surcharge to 1x or seller-absorbed installments", () => {
    expect(
      resolveContractedAmount({
        baseAmountInCents: 10_000,
        count: 1,
        policy: "buyer_pays_incremental_installment_cost",
        quotedGrossAmountInCents: 10_410,
      })
    ).toBe(10_000);
    expect(
      resolveContractedAmount({
        baseAmountInCents: 10_000,
        count: 6,
        policy: "seller_absorbs_all",
        quotedGrossAmountInCents: 10_410,
      })
    ).toBe(10_000);
  });

  it("uses the quoted gross for incremental installments above 1x", () => {
    expect(
      resolveContractedAmount({
        baseAmountInCents: 10_000,
        count: 3,
        policy: "buyer_pays_incremental_installment_cost",
        quotedGrossAmountInCents: 10_048,
      })
    ).toBe(10_048);
    expect(resolveSurchargeAmount(10_000, 10_048)).toBe(48);
  });

  it("puts indivisible cents in the last installment", () => {
    expect(
      createInstallmentSchedule({ count: 3, grossAmountInCents: 10_048 })
    ).toEqual({
      count: 3,
      installmentAmountInCents: 3349,
      lastInstallmentAmountInCents: 3350,
    });
  });

  it("rejects a schedule below the ten-real installment floor", () => {
    expect(() =>
      createInstallmentSchedule({ count: 3, grossAmountInCents: 2999 })
    ).toThrow("Cada parcela deve ser de pelo menos R$ 10,00.");
  });

  it.each([
    { count: 0, grossAmountInCents: 10_000 },
    { count: 13, grossAmountInCents: 130_000 },
    { count: 1.5, grossAmountInCents: 10_000 },
    { count: 2, grossAmountInCents: 10_000.5 },
  ])("rejects invalid money or count: $count", (input) => {
    expect(() => createInstallmentSchedule(input)).toThrow();
  });
});
