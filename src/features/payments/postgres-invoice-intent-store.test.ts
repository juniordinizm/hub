import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { InvoiceIntentPreparationError } from "./invoice-intent";

vi.mock("server-only", () => ({}));

import { PostgresInvoiceIntentStore } from "./postgres-invoice-intent-store";

describe("PostgresInvoiceIntentStore", () => {
  it("expires a stale quote so a page refresh can publish current pricing", async () => {
    const now = new Date("2026-08-03T15:00:00.000Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            access_duration_months: 12,
            allow_credit_card: true,
            allow_pix: true,
            base_amount_in_cents: 10_000,
            card_pricing_policy: "buyer_pays_incremental_installment_cost",
            course_description: "Curso",
            course_id: "course-id",
            course_status: "active",
            course_title: "Curso",
            current_allow_credit_card: true,
            current_allow_pix: true,
            current_card_pricing_policy:
              "buyer_pays_incremental_installment_cost",
            current_max_installment_count: 3,
            current_price_in_cents: 10_000,
            expires_at: new Date("2026-08-03T15:30:00.000Z"),
            generated_at: new Date("2026-08-03T14:55:00.000Z"),
            max_installment_count: 3,
            options_json: {
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
            quote_id: "quote-id",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const gateway = {
      getAccountFees: vi.fn(async () => ({
        oneInstallmentPercentageBasisPoints: 299,
        operationFeeInCents: 49,
        upToSixInstallmentsPercentageBasisPoints: 349,
        upToTwelveInstallmentsPercentageBasisPoints: 399,
      })),
      simulatePayment: vi.fn(
        async ({ valueInCents }: { valueInCents: number }) => ({
          feePercentageBasisPoints: 349,
          installmentAmountInCents: Math.floor(valueInCents / 3),
          installmentNetAmountInCents: Math.floor((valueInCents - 397) / 3),
          netAmountInCents: valueInCents - 397,
          operationFeeInCents: 49,
        })
      ),
    };
    const store = new PostgresInvoiceIntentStore({
      gateway,
      now: () => now,
      pool: { query } as unknown as Pool,
    });

    await expect(
      store.prepare({
        courseSlug: "curso",
        cpfCnpj: "39053344705",
        email: "buyer@example.com",
        installmentCount: 3,
        name: "Compradora",
        paymentMethod: "credit_card",
        purchaseAttemptId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
        quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
      })
    ).rejects.toMatchObject({
      kind: "quote_stale",
    } satisfies Partial<InvoiceIntentPreparationError>);

    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("set expires_at = least(expires_at, $2)"),
      ["quote-id", now]
    );
  });
});
