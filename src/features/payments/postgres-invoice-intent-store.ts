import "server-only";
import type { Pool } from "pg";
import { getPool } from "@/db";
import type { AsaasCreditCardFeeSchedule } from "./asaas";
import type { InvoiceIntentResult, InvoiceIntentStore } from "./invoice-intent";
import { InvoiceIntentPreparationError } from "./invoice-intent";
import type { PaymentQuoteGateway, PaymentQuoteOption } from "./payment-quotes";
import { revalidateSelectedQuote } from "./payment-quotes";
import { parseStoredPaymentQuoteOptions } from "./postgres-payment-quote-repository";
import type { PublicPurchaseBody } from "./public-purchase-api";

interface ExistingOrderRow {
  checkout_course_slug: string;
  checkout_status:
    | "active"
    | "cancelled"
    | "creating"
    | "expired"
    | "failed"
    | "pending"
    | "uncertain";
  checkout_url: string | null;
  customer_email: string | null;
  id: string;
  provider_purchase_flow: "checkout" | "invoice";
}

interface QuoteCourseRow {
  access_duration_months: number;
  allow_credit_card: boolean;
  allow_pix: boolean;
  base_amount_in_cents: number;
  card_pricing_policy:
    | "buyer_pays_incremental_installment_cost"
    | "seller_absorbs_all";
  course_description: string | null;
  course_id: string;
  course_status: string;
  course_title: string;
  current_allow_credit_card: boolean;
  current_allow_pix: boolean;
  current_card_pricing_policy:
    | "buyer_pays_incremental_installment_cost"
    | "seller_absorbs_all";
  current_max_installment_count: number;
  current_price_in_cents: number;
  expires_at: Date;
  generated_at: Date;
  max_installment_count: number;
  options_json: unknown;
  quote_id: string;
}

interface BuyerEligibilityRow {
  enrollment_status: "active" | "revoked" | null;
  platform_blocked_at: Date | null;
  role: "admin" | "student" | "support" | null;
  user_id: string | null;
}

const duplicateResult = (order: ExistingOrderRow): InvoiceIntentResult => {
  if (order.checkout_status === "active" && order.checkout_url) {
    return {
      orderId: order.id,
      redirectUrl: order.checkout_url,
      status: "ready",
    };
  }
  return {
    orderId: order.id,
    status: order.checkout_status === "failed" ? "failed" : "processing",
  };
};

const ensureSameAttempt = (
  order: ExistingOrderRow,
  input: PublicPurchaseBody
): void => {
  if (
    order.provider_purchase_flow !== "invoice" ||
    order.checkout_course_slug !== input.courseSlug ||
    order.customer_email !== input.email
  ) {
    throw new InvoiceIntentPreparationError(
      "conflict",
      "Tentativa de compra em conflito."
    );
  }
};

const selectOption = (
  quote: QuoteCourseRow,
  input: PublicPurchaseBody
): PaymentQuoteOption => {
  const options = parseStoredPaymentQuoteOptions(quote.options_json);
  if (input.paymentMethod === "pix") {
    if (!(quote.allow_pix && options.pix && input.installmentCount === 1)) {
      throw new InvoiceIntentPreparationError(
        "quote_stale",
        "Pix nao esta disponivel nesta cotacao."
      );
    }
    return {
      count: 1,
      feeAmountInCents: null,
      feePercentageBasisPoints: null,
      grossAmountInCents: options.pix.grossAmountInCents,
      installmentAmountInCents: options.pix.grossAmountInCents,
      lastInstallmentAmountInCents: options.pix.grossAmountInCents,
      netAmountInCents: null,
      operationFeeInCents: null,
      surchargeAmountInCents: 0,
      targetNetAmountInCents: null,
    };
  }
  if (!quote.allow_credit_card) {
    throw new InvoiceIntentPreparationError(
      "quote_stale",
      "Cartao nao esta disponivel nesta cotacao."
    );
  }
  const option = options.cardOptions.find(
    (candidate) => candidate.count === input.installmentCount
  );
  if (!option) {
    throw new InvoiceIntentPreparationError(
      "quote_stale",
      "Parcelamento nao esta disponivel nesta cotacao."
    );
  }
  return option;
};

const offerStillMatches = (quote: QuoteCourseRow): boolean =>
  quote.course_status === "active" &&
  quote.base_amount_in_cents === quote.current_price_in_cents &&
  quote.allow_pix === quote.current_allow_pix &&
  quote.allow_credit_card === quote.current_allow_credit_card &&
  quote.max_installment_count === quote.current_max_installment_count &&
  quote.card_pricing_policy === quote.current_card_pricing_policy;

export class PostgresInvoiceIntentStore implements InvoiceIntentStore {
  private readonly authorize: ((courseId: string) => Promise<void>) | undefined;
  private readonly gateway: PaymentQuoteGateway;
  private readonly now: () => Date;
  private readonly pool: Pool;

  constructor({
    gateway,
    now = () => new Date(),
    pool = getPool(),
    authorize,
  }: {
    authorize?: (courseId: string) => Promise<void>;
    gateway: PaymentQuoteGateway;
    now?: () => Date;
    pool?: Pool;
  }) {
    this.authorize = authorize;
    this.gateway = gateway;
    this.now = now;
    this.pool = pool;
  }

  async prepare(input: PublicPurchaseBody) {
    const existing = await this.readOrder(input.purchaseAttemptId);
    if (existing) {
      ensureSameAttempt(existing, input);
      return {
        result: duplicateResult(existing),
        status: "duplicate" as const,
      };
    }

    const quoteResult = await this.pool.query<QuoteCourseRow>(
      `
        select q.id as quote_id, q.course_id, q.base_amount_in_cents,
               q.allow_pix, q.allow_credit_card, q.max_installment_count,
               q.card_pricing_policy, q.options_json, q.generated_at, q.expires_at,
               c.title as course_title, c.description as course_description,
               c.access_duration_months, c.status as course_status,
               c.price_in_cents as current_price_in_cents,
               c.payment_allow_pix as current_allow_pix,
               c.payment_allow_credit_card as current_allow_credit_card,
               c.payment_max_installment_count as current_max_installment_count,
               c.payment_card_pricing_policy as current_card_pricing_policy
        from course_payment_quotes q
        join courses c on c.id = q.course_id
        where q.id = $1 and c.slug = $2 and q.expires_at > $3
          and exists (
            select 1 from course_publications cp
            where cp.course_id = c.id and cp.status = 'published'
          )
        limit 1
      `,
      [input.quoteId, input.courseSlug, this.now()]
    );
    const quote = quoteResult.rows[0];
    if (!(quote && offerStillMatches(quote))) {
      throw new InvoiceIntentPreparationError(
        "quote_stale",
        "Cotacao expirada ou oferta alterada."
      );
    }
    const selected = selectOption(quote, input);
    await this.revalidateSelection(quote, selected, input.paymentMethod);
    const buyer = await this.readBuyerEligibility(input.email, quote.course_id);
    if (
      buyer?.role === "admin" ||
      buyer?.role === "support" ||
      buyer?.platform_blocked_at ||
      buyer?.enrollment_status === "active" ||
      buyer?.enrollment_status === "revoked"
    ) {
      throw new InvoiceIntentPreparationError(
        "identity_ineligible",
        "Identidade nao elegivel para compra."
      );
    }
    await this.authorize?.(quote.course_id);

    const courseName = Array.from(quote.course_title.trim())
      .slice(0, 30)
      .join("");
    const courseDescription = Array.from(
      quote.course_description?.trim() || courseName
    )
      .slice(0, 150)
      .join("");
    const inserted = await this.pool.query<{ id: string }>(
      `
        insert into orders (
          id, course_id, user_id, buyer_identity_status, provider,
          provider_purchase_flow, external_id, status, checkout_status,
          amount_in_cents, base_amount_in_cents, surcharge_amount_in_cents,
          installment_count, card_pricing_policy, payment_quote_id,
          target_net_amount_in_cents, quoted_net_amount_in_cents,
          quoted_fee_amount_in_cents, quoted_fee_percentage_basis_points,
          quoted_operation_fee_in_cents, quoted_at, payment_method,
          payment_allow_pix, payment_allow_credit_card,
          payment_max_installment_count, access_duration_months,
          customer_email, customer_name, checkout_course_slug,
          checkout_item_name, checkout_item_description
        ) values (
          $1, $2, $3, $4, 'asaas', 'invoice', $5, 'pending', 'pending',
          $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27
        )
        on conflict (id) do nothing
        returning id
      `,
      [
        input.purchaseAttemptId,
        quote.course_id,
        buyer?.user_id ?? null,
        buyer?.user_id ? "resolved" : "pending",
        `order_${input.purchaseAttemptId}`,
        selected.grossAmountInCents,
        quote.base_amount_in_cents,
        selected.surchargeAmountInCents,
        selected.count,
        quote.card_pricing_policy,
        quote.quote_id,
        selected.targetNetAmountInCents,
        selected.netAmountInCents,
        selected.feeAmountInCents,
        selected.feePercentageBasisPoints,
        selected.operationFeeInCents,
        quote.generated_at,
        input.paymentMethod === "pix" ? "PIX" : "CREDIT_CARD",
        quote.allow_pix,
        quote.allow_credit_card,
        quote.max_installment_count,
        quote.access_duration_months,
        input.email,
        input.name,
        input.courseSlug,
        courseName,
        courseDescription,
      ]
    );
    if (!inserted.rows[0]) {
      const concurrent = await this.readOrder(input.purchaseAttemptId);
      if (!concurrent) {
        throw new InvoiceIntentPreparationError(
          "conflict",
          "Tentativa de compra nao foi persistida."
        );
      }
      ensureSameAttempt(concurrent, input);
      return {
        result: duplicateResult(concurrent),
        status: "duplicate" as const,
      };
    }
    return {
      intent: {
        amountInCents: selected.grossAmountInCents,
        baseAmountInCents: quote.base_amount_in_cents,
        cardPricingPolicy: quote.card_pricing_policy,
        courseDescription,
        customerEmail: input.email,
        customerName: input.name,
        externalReference: `order_${input.purchaseAttemptId}`,
        installmentCount: selected.count,
        orderId: input.purchaseAttemptId,
        paymentMethod: input.paymentMethod,
        surchargeAmountInCents: selected.surchargeAmountInCents,
      },
      status: "created" as const,
    };
  }

  async claimCreating(orderId: string): Promise<boolean> {
    const result = await this.pool.query(
      `update orders
       set checkout_status = 'creating', checkout_attempt_count = checkout_attempt_count + 1,
           checkout_last_attempt_at = now(), checkout_error_message = null,
           updated_at = now()
       where id = $1 and provider_purchase_flow = 'invoice'
         and checkout_status = 'pending'
       returning id`,
      [orderId]
    );
    return Boolean(result.rows[0]);
  }

  async setProviderCustomer(
    orderId: string,
    providerCustomerId: string
  ): Promise<void> {
    await this.pool.query(
      `update orders set provider_customer_id = $2, updated_at = now()
       where id = $1 and checkout_status = 'creating'`,
      [orderId, providerCustomerId]
    );
  }

  async markReady(
    orderId: string,
    payment: {
      id: string;
      installmentId: string | null;
      invoiceUrl: string;
      status: string;
    }
  ): Promise<boolean> {
    const result = await this.pool.query(
      `update orders
       set provider_payment_id = $2, provider_installment_id = $3,
           checkout_url = $4, provider_payment_status = $5,
           checkout_status = 'active', checkout_error_message = null,
           updated_at = now()
       where id = $1 and checkout_status = 'creating'
       returning id`,
      [
        orderId,
        payment.id,
        payment.installmentId,
        payment.invoiceUrl,
        payment.status,
      ]
    );
    return Boolean(result.rows[0]);
  }

  async markUncertain(orderId: string): Promise<void> {
    await this.setTerminalState(orderId, "uncertain", "asaas_payment_unknown");
  }

  async markFailed(orderId: string): Promise<void> {
    await this.setTerminalState(orderId, "failed", "asaas_payment_rejected");
  }

  private async readOrder(orderId: string): Promise<ExistingOrderRow | null> {
    const result = await this.pool.query<ExistingOrderRow>(
      `select id, provider_purchase_flow, checkout_status, checkout_url,
              checkout_course_slug, customer_email
       from orders where id = $1 limit 1`,
      [orderId]
    );
    return result.rows[0] ?? null;
  }

  private async readBuyerEligibility(
    email: string,
    courseId: string
  ): Promise<BuyerEligibilityRow | null> {
    const result = await this.pool.query<BuyerEligibilityRow>(
      `select u.id as user_id, p.role, p.platform_blocked_at,
              (select e.status from enrollments e
               where e.user_id = u.id and e.course_id = $2
                 and (e.status = 'revoked' or
                      (e.status = 'active' and e.starts_at <= now() and e.expires_at >= now()))
               order by case when e.status = 'revoked' then 0 else 1 end
               limit 1) as enrollment_status
       from users u left join profiles p on p.user_id = u.id
       where lower(u.email) = $1 limit 1`,
      [email, courseId]
    );
    return result.rows[0] ?? null;
  }

  private async revalidateSelection(
    quote: QuoteCourseRow,
    selected: PaymentQuoteOption,
    paymentMethod: "credit_card" | "pix"
  ): Promise<void> {
    if (
      paymentMethod === "pix" ||
      selected.count === 1 ||
      quote.card_pricing_policy === "seller_absorbs_all"
    ) {
      return;
    }
    let feeSchedule: AsaasCreditCardFeeSchedule;
    try {
      feeSchedule = await this.gateway.getAccountFees();
    } catch {
      throw new InvoiceIntentPreparationError(
        "temporarily_unavailable",
        "Cotacao temporariamente indisponivel."
      );
    }
    const result = await revalidateSelectedQuote({
      baseAmountInCents: quote.base_amount_in_cents,
      cardPricingPolicy: quote.card_pricing_policy,
      feeSchedule,
      now: this.now(),
      selected,
      simulatePayment: this.gateway.simulatePayment.bind(this.gateway),
    });
    if (result.status === "stale") {
      await this.pool.query(
        `update course_payment_quotes
         set expires_at = least(expires_at, $2)
         where id = $1`,
        [quote.quote_id, this.now()]
      );
      throw new InvoiceIntentPreparationError(
        "quote_stale",
        "Cotacao alterada."
      );
    }
    if (result.status === "unavailable") {
      throw new InvoiceIntentPreparationError(
        "temporarily_unavailable",
        "Cotacao temporariamente indisponivel."
      );
    }
  }

  private async setTerminalState(
    orderId: string,
    status: "failed" | "uncertain",
    errorMessage: string
  ): Promise<void> {
    await this.pool.query(
      `update orders set checkout_status = $2, checkout_error_message = $3,
              updated_at = now()
       where id = $1 and checkout_status = 'creating'`,
      [orderId, status, errorMessage]
    );
  }
}
