import "server-only";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { getPool } from "@/db";
import type { AsaasCreditCardFeeSchedule } from "./asaas";
import type {
  PaymentQuoteRecord,
  PaymentQuoteRepository,
} from "./payment-quotes";

const monetaryValue = z.number().int().nonnegative();
const quoteOptionSchema = z.object({
  count: z.number().int().min(1).max(12),
  feeAmountInCents: monetaryValue.nullable(),
  feePercentageBasisPoints: monetaryValue.nullable(),
  grossAmountInCents: monetaryValue,
  installmentAmountInCents: monetaryValue,
  lastInstallmentAmountInCents: monetaryValue,
  netAmountInCents: monetaryValue.nullable(),
  operationFeeInCents: monetaryValue.nullable(),
  surchargeAmountInCents: monetaryValue,
  targetNetAmountInCents: monetaryValue.nullable(),
});
const quoteOptionsSchema = z.object({
  cardOptions: z.array(quoteOptionSchema).max(12),
  installmentsTemporarilyUnavailable: z.boolean(),
  pix: z.object({ grossAmountInCents: monetaryValue }).nullable(),
});
export const parseStoredPaymentQuoteOptions = (value: unknown) =>
  quoteOptionsSchema.parse(value);
const feeProfileSchema = z
  .object({
    discountExpiration: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    oneInstallmentPercentageBasisPoints: monetaryValue,
    operationFeeInCents: monetaryValue,
    promotionalOneInstallmentPercentageBasisPoints: monetaryValue.optional(),
    promotionalUpToSixInstallmentsPercentageBasisPoints:
      monetaryValue.optional(),
    promotionalUpToTwelveInstallmentsPercentageBasisPoints:
      monetaryValue.optional(),
    upToSixInstallmentsPercentageBasisPoints: monetaryValue,
    upToTwelveInstallmentsPercentageBasisPoints: monetaryValue,
  })
  .nullable();

const parseFeeProfile = (value: unknown): AsaasCreditCardFeeSchedule | null => {
  const parsed = feeProfileSchema.parse(value);
  if (!parsed) {
    return null;
  }
  return {
    ...(parsed.discountExpiration
      ? { discountExpiration: parsed.discountExpiration }
      : {}),
    oneInstallmentPercentageBasisPoints:
      parsed.oneInstallmentPercentageBasisPoints,
    operationFeeInCents: parsed.operationFeeInCents,
    ...(parsed.promotionalOneInstallmentPercentageBasisPoints === undefined
      ? {}
      : {
          promotionalOneInstallmentPercentageBasisPoints:
            parsed.promotionalOneInstallmentPercentageBasisPoints,
        }),
    ...(parsed.promotionalUpToSixInstallmentsPercentageBasisPoints === undefined
      ? {}
      : {
          promotionalUpToSixInstallmentsPercentageBasisPoints:
            parsed.promotionalUpToSixInstallmentsPercentageBasisPoints,
        }),
    ...(parsed.promotionalUpToTwelveInstallmentsPercentageBasisPoints ===
    undefined
      ? {}
      : {
          promotionalUpToTwelveInstallmentsPercentageBasisPoints:
            parsed.promotionalUpToTwelveInstallmentsPercentageBasisPoints,
        }),
    upToSixInstallmentsPercentageBasisPoints:
      parsed.upToSixInstallmentsPercentageBasisPoints,
    upToTwelveInstallmentsPercentageBasisPoints:
      parsed.upToTwelveInstallmentsPercentageBasisPoints,
  };
};

interface QuoteRow {
  allow_credit_card: boolean;
  allow_pix: boolean;
  base_amount_in_cents: number;
  card_pricing_policy:
    | "buyer_pays_incremental_installment_cost"
    | "seller_absorbs_all";
  course_id: string;
  expires_at: Date;
  fee_profile_json: unknown;
  generated_at: Date;
  id: string;
  max_installment_count: number;
  options_json: unknown;
  provider_environment: "production" | "sandbox";
  signature: string;
}

const mapQuoteRow = (row: QuoteRow): PaymentQuoteRecord => ({
  allowCreditCard: row.allow_credit_card,
  allowPix: row.allow_pix,
  baseAmountInCents: row.base_amount_in_cents,
  cardPricingPolicy: row.card_pricing_policy,
  courseId: row.course_id,
  expiresAt: row.expires_at,
  feeProfile: parseFeeProfile(row.fee_profile_json),
  generatedAt: row.generated_at,
  id: row.id,
  maxInstallmentCount: row.max_installment_count,
  options: parseStoredPaymentQuoteOptions(row.options_json),
  providerEnvironment: row.provider_environment,
  signature: row.signature,
});

const quoteSelection = `
  select id, course_id, provider_environment, signature,
         base_amount_in_cents, allow_pix, allow_credit_card,
         max_installment_count, card_pricing_policy, options_json,
         fee_profile_json, generated_at, expires_at
  from course_payment_quotes
`;

export class PostgresPaymentQuoteRepository implements PaymentQuoteRepository {
  private readonly pool: Pool;

  constructor(pool: Pool = getPool()) {
    this.pool = pool;
  }

  async findActive({
    now,
    signature,
  }: {
    now: Date;
    signature: string;
  }): Promise<PaymentQuoteRecord | null> {
    const result = await this.pool.query<QuoteRow>(
      `${quoteSelection}
       where signature = $1 and expires_at > $2
       order by generated_at desc
       limit 1`,
      [signature, now]
    );
    return result.rows[0] ? mapQuoteRow(result.rows[0]) : null;
  }

  async publishIfAbsent(
    record: Omit<PaymentQuoteRecord, "id">
  ): Promise<PaymentQuoteRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [record.signature]
      );
      const active = await this.findActiveWithClient(client, {
        now: record.generatedAt,
        signature: record.signature,
      });
      if (active) {
        await client.query("commit");
        return active;
      }
      const inserted = await client.query<QuoteRow>(
        `
          insert into course_payment_quotes (
            course_id, provider, provider_environment, signature,
            base_amount_in_cents, allow_pix, allow_credit_card,
            max_installment_count, card_pricing_policy, options_json,
            fee_profile_json, generated_at, expires_at
          )
          values ($1, 'asaas', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          returning id, course_id, provider_environment, signature,
                    base_amount_in_cents, allow_pix, allow_credit_card,
                    max_installment_count, card_pricing_policy, options_json,
                    fee_profile_json, generated_at, expires_at
        `,
        [
          record.courseId,
          record.providerEnvironment,
          record.signature,
          record.baseAmountInCents,
          record.allowPix,
          record.allowCreditCard,
          record.maxInstallmentCount,
          record.cardPricingPolicy,
          record.options,
          record.feeProfile,
          record.generatedAt,
          record.expiresAt,
        ]
      );
      const row = inserted.rows[0];
      if (!row) {
        throw new Error("Cotacao nao foi persistida.");
      }
      await client.query("commit");
      return mapQuoteRow(row);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async findActiveWithClient(
    client: PoolClient,
    { now, signature }: { now: Date; signature: string }
  ): Promise<PaymentQuoteRecord | null> {
    const result = await client.query<QuoteRow>(
      `${quoteSelection}
       where signature = $1 and expires_at > $2
       order by generated_at desc
       limit 1`,
      [signature, now]
    );
    return result.rows[0] ? mapQuoteRow(result.rows[0]) : null;
  }
}
