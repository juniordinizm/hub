import { describe, expect, it, vi } from "vitest";
import type {
  AsaasCreditCardFeeSchedule,
  AsaasPaymentSimulation,
} from "./asaas";
import {
  buildPaymentQuoteOptions,
  createCoursePaymentQuote,
  type PaymentQuoteGateway,
  type PaymentQuoteRecord,
  type PaymentQuoteRepository,
  revalidateSelectedQuote,
} from "./payment-quotes";

const feeSchedule: AsaasCreditCardFeeSchedule = {
  oneInstallmentPercentageBasisPoints: 299,
  operationFeeInCents: 49,
  upToSixInstallmentsPercentageBasisPoints: 349,
  upToTwelveInstallmentsPercentageBasisPoints: 399,
};

const simulation = ({
  grossAmountInCents,
  netAmountInCents,
}: {
  grossAmountInCents: number;
  netAmountInCents: number;
}): AsaasPaymentSimulation => ({
  feePercentageBasisPoints: 349,
  installmentAmountInCents: grossAmountInCents,
  installmentNetAmountInCents: netAmountInCents,
  netAmountInCents,
  operationFeeInCents: 49,
});

describe("payment quotes", () => {
  it("offers seller-absorbed installments at the base price without simulation", async () => {
    const simulateCard = vi.fn();

    await expect(
      buildPaymentQuoteOptions({
        allowCreditCard: true,
        allowPix: true,
        baseAmountInCents: 3000,
        cardPricingPolicy: "seller_absorbs_all",
        feeSchedule,
        maxInstallmentCount: 3,
        simulateCard,
      })
    ).resolves.toMatchObject({
      cardOptions: [
        {
          count: 1,
          grossAmountInCents: 3000,
          installmentAmountInCents: 3000,
          lastInstallmentAmountInCents: 3000,
          surchargeAmountInCents: 0,
        },
        {
          count: 2,
          grossAmountInCents: 3000,
          installmentAmountInCents: 1500,
          lastInstallmentAmountInCents: 1500,
          surchargeAmountInCents: 0,
        },
        {
          count: 3,
          grossAmountInCents: 3000,
          installmentAmountInCents: 1000,
          lastInstallmentAmountInCents: 1000,
          surchargeAmountInCents: 0,
        },
      ],
      installmentsTemporarilyUnavailable: false,
      pix: { grossAmountInCents: 3000 },
    });
    expect(simulateCard).not.toHaveBeenCalled();
  });

  it("preserves the 1x net with the smallest verified gross per count", async () => {
    const minimumGrossByCount = new Map([
      [2, 10_050],
      [3, 10_048],
    ]);
    const simulateCard = vi.fn(
      ({
        grossAmountInCents,
        installmentCount,
      }: {
        grossAmountInCents: number;
        installmentCount: number;
      }): Promise<AsaasPaymentSimulation> => {
        if (installmentCount === 1) {
          return Promise.resolve(
            simulation({
              grossAmountInCents,
              netAmountInCents: 9652,
            })
          );
        }
        const minimum = minimumGrossByCount.get(installmentCount);
        if (minimum === undefined) {
          throw new Error("unexpected count");
        }
        return Promise.resolve(
          simulation({
            grossAmountInCents,
            netAmountInCents: 9652 + grossAmountInCents - minimum,
          })
        );
      }
    );

    const quote = await buildPaymentQuoteOptions({
      allowCreditCard: true,
      allowPix: true,
      baseAmountInCents: 10_000,
      cardPricingPolicy: "buyer_pays_incremental_installment_cost",
      feeSchedule,
      maxInstallmentCount: 3,
      simulateCard,
    });

    expect(quote.cardOptions).toEqual([
      expect.objectContaining({
        count: 1,
        grossAmountInCents: 10_000,
        netAmountInCents: 9652,
        surchargeAmountInCents: 0,
      }),
      expect.objectContaining({
        count: 2,
        grossAmountInCents: 10_050,
        netAmountInCents: 9652,
        surchargeAmountInCents: 50,
      }),
      expect.objectContaining({
        count: 3,
        grossAmountInCents: 10_048,
        installmentAmountInCents: 3349,
        lastInstallmentAmountInCents: 3350,
        netAmountInCents: 9652,
        surchargeAmountInCents: 48,
      }),
    ]);
  });

  it("keeps Pix and card 1x when installment simulation is unavailable", async () => {
    const result = await buildPaymentQuoteOptions({
      allowCreditCard: true,
      allowPix: true,
      baseAmountInCents: 10_000,
      cardPricingPolicy: "buyer_pays_incremental_installment_cost",
      feeSchedule,
      maxInstallmentCount: 3,
      simulateCard: ({ installmentCount, grossAmountInCents }) => {
        if (installmentCount === 1) {
          return Promise.resolve(
            simulation({
              grossAmountInCents,
              netAmountInCents: 9652,
            })
          );
        }
        return Promise.reject(new Error("simulator unavailable"));
      },
    });

    expect(result.cardOptions).toEqual([
      expect.objectContaining({ count: 1, grossAmountInCents: 10_000 }),
    ]);
    expect(result.installmentsTemporarilyUnavailable).toBe(true);
    expect(result.pix).toEqual({ grossAmountInCents: 10_000 });
  });

  it("filters every option whose regular installment is below R$10", async () => {
    const result = await buildPaymentQuoteOptions({
      allowCreditCard: true,
      allowPix: false,
      baseAmountInCents: 1990,
      cardPricingPolicy: "seller_absorbs_all",
      feeSchedule,
      maxInstallmentCount: 12,
      simulateCard: vi.fn(),
    });

    expect(result.cardOptions.map((option) => option.count)).toEqual([1]);
  });

  it("never exceeds the configured twelve-installment ceiling", async () => {
    const result = await buildPaymentQuoteOptions({
      allowCreditCard: true,
      allowPix: false,
      baseAmountInCents: 120_000,
      cardPricingPolicy: "seller_absorbs_all",
      feeSchedule,
      maxInstallmentCount: 21,
      simulateCard: vi.fn(),
    });

    expect(result.cardOptions).toHaveLength(12);
    expect(result.cardOptions.at(-1)?.count).toBe(12);
  });

  it("uses promotional fees only through the documented expiration date", async () => {
    const promotionalFeeSchedule: AsaasCreditCardFeeSchedule = {
      ...feeSchedule,
      discountExpiration: "2026-08-31",
      promotionalUpToSixInstallmentsPercentageBasisPoints: 100,
    };
    const firstGrossByDate = new Map<string, number>();

    for (const now of [
      new Date("2026-08-31T23:59:59-03:00"),
      new Date("2026-09-01T00:00:00-03:00"),
    ]) {
      const simulateCard = vi.fn(
        async ({ grossAmountInCents, installmentCount }) =>
          simulation({
            grossAmountInCents,
            netAmountInCents:
              installmentCount === 1 ? 9652 : grossAmountInCents - 398,
          })
      );
      await buildPaymentQuoteOptions({
        allowCreditCard: true,
        allowPix: false,
        baseAmountInCents: 10_000,
        cardPricingPolicy: "buyer_pays_incremental_installment_cost",
        feeSchedule: promotionalFeeSchedule,
        maxInstallmentCount: 2,
        now,
        simulateCard,
      });
      firstGrossByDate.set(
        now.toISOString(),
        simulateCard.mock.calls.find(
          ([input]) => input.installmentCount === 2
        )?.[0].grossAmountInCents ?? 0
      );
    }

    expect(firstGrossByDate.get("2026-09-01T02:59:59.000Z")).toBe(10_000);
    expect(firstGrossByDate.get("2026-09-01T03:00:00.000Z")).toBe(10_052);
  });

  it("reuses a live quote for the same deterministic offer signature", async () => {
    const records: PaymentQuoteRecord[] = [];
    const repository: PaymentQuoteRepository = {
      findActive: async ({ now, signature }) =>
        records.find(
          (record) => record.signature === signature && record.expiresAt > now
        ) ?? null,
      publishIfAbsent: (record) => {
        const active = records.find(
          (candidate) =>
            candidate.signature === record.signature &&
            candidate.expiresAt > record.generatedAt
        );
        if (active) {
          return Promise.resolve(active);
        }
        const persisted = { ...record, id: crypto.randomUUID() };
        records.push(persisted);
        return Promise.resolve(persisted);
      },
    };
    const gateway: PaymentQuoteGateway = {
      getAccountFees: vi.fn(async () => feeSchedule),
      simulatePayment: vi.fn(async ({ valueInCents, installmentCount }) =>
        simulation({
          grossAmountInCents: valueInCents,
          netAmountInCents: installmentCount === 1 ? 9652 : valueInCents - 398,
        })
      ),
    };
    const input = {
      course: {
        allowCreditCard: true,
        allowPix: true,
        baseAmountInCents: 10_000,
        cardPricingPolicy: "buyer_pays_incremental_installment_cost" as const,
        courseId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
        maxInstallmentCount: 3,
      },
      gateway,
      now: () => new Date("2026-08-03T12:00:00-03:00"),
      providerEnvironment: "sandbox" as const,
      repository,
    };

    const first = await createCoursePaymentQuote(input);
    const second = await createCoursePaymentQuote(input);

    expect(second.id).toBe(first.id);
    expect(records).toHaveLength(1);
    expect(gateway.getAccountFees).toHaveBeenCalledOnce();
  });

  it("publishes one active record when quote generations race", async () => {
    const records: PaymentQuoteRecord[] = [];
    const repository: PaymentQuoteRepository = {
      findActive: async () => null,
      publishIfAbsent: async (record) => {
        await Promise.resolve();
        const active = records.find(
          (candidate) => candidate.signature === record.signature
        );
        if (active) {
          return active;
        }
        const persisted = { ...record, id: crypto.randomUUID() };
        records.push(persisted);
        return persisted;
      },
    };
    const gateway: PaymentQuoteGateway = {
      getAccountFees: async () => feeSchedule,
      simulatePayment: async ({ valueInCents, installmentCount }) =>
        simulation({
          grossAmountInCents: valueInCents,
          netAmountInCents: installmentCount === 1 ? 9652 : valueInCents - 398,
        }),
    };
    const input = {
      course: {
        allowCreditCard: true,
        allowPix: true,
        baseAmountInCents: 10_000,
        cardPricingPolicy: "buyer_pays_incremental_installment_cost" as const,
        courseId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
        maxInstallmentCount: 3,
      },
      gateway,
      now: () => new Date("2026-08-03T12:00:00-03:00"),
      providerEnvironment: "sandbox" as const,
      repository,
    };

    const [first, second] = await Promise.all([
      createCoursePaymentQuote(input),
      createCoursePaymentQuote(input),
    ]);

    expect(first.id).toBe(second.id);
    expect(records).toHaveLength(1);
  });

  it("revalidates only the selected installment count and rejects changed totals", async () => {
    const selected = {
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
    };
    const simulatePayment = vi.fn(async ({ valueInCents, installmentCount }) =>
      simulation({
        grossAmountInCents: valueInCents,
        netAmountInCents:
          9652 + valueInCents - (installmentCount === 3 ? 10_049 : 0),
      })
    );

    const result = await revalidateSelectedQuote({
      baseAmountInCents: 10_000,
      cardPricingPolicy: "buyer_pays_incremental_installment_cost",
      feeSchedule,
      now: new Date("2026-08-03T12:01:00-03:00"),
      selected,
      simulatePayment,
    });

    expect(result).toMatchObject({
      current: { count: 3, grossAmountInCents: 10_049 },
      status: "stale",
    });
    expect(
      new Set(
        simulatePayment.mock.calls.map(([input]) => input.installmentCount)
      )
    ).toEqual(new Set([3]));
  });
});
