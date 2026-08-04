import "server-only";
import { createHmac } from "node:crypto";
import { getPool } from "@/db";
import { getServerEnv } from "@/lib/env";
import { assertCheckoutAvailable } from "./checkout-availability";
import { createCoursePaymentQuote } from "./payment-quotes";
import { PostgresPaymentQuoteRepository } from "./postgres-payment-quote-repository";
import { getAsaasProviderClient } from "./provider";
import { serializePublicPaymentQuote } from "./public-purchase-api";

const QUOTE_RATE_LIMIT = 30;

interface PublicQuoteCourse {
  id: string;
  payment_allow_credit_card: boolean;
  payment_allow_pix: boolean;
  payment_card_pricing_policy:
    | "buyer_pays_incremental_installment_cost"
    | "seller_absorbs_all";
  payment_max_installment_count: number;
  price_in_cents: number;
}

const authorizeQuoteRequest = async ({
  courseId,
  ipAddress,
  secret,
}: {
  courseId: string;
  ipAddress: string;
  secret: string;
}): Promise<void> => {
  const keyHash = createHmac("sha256", secret)
    .update("payment-quote:v1:")
    .update(ipAddress)
    .update("\0")
    .update(courseId)
    .digest("hex");
  const consumed = await getPool().query(
    `
      insert into public_checkout_rate_limits (
        key_hash, window_started_at, request_count, expires_at
      )
      values ($1, now(), 1, now() + interval '10 minutes')
      on conflict (key_hash) do update set
        window_started_at = case
          when public_checkout_rate_limits.expires_at <= now() then now()
          else public_checkout_rate_limits.window_started_at
        end,
        request_count = case
          when public_checkout_rate_limits.expires_at <= now() then 1
          else public_checkout_rate_limits.request_count + 1
        end,
        expires_at = case
          when public_checkout_rate_limits.expires_at <= now()
            then now() + interval '10 minutes'
          else public_checkout_rate_limits.expires_at
        end,
        updated_at = now()
      where public_checkout_rate_limits.expires_at <= now()
         or public_checkout_rate_limits.request_count < $2
      returning key_hash
    `,
    [keyHash, QUOTE_RATE_LIMIT]
  );
  if (!consumed.rows[0]) {
    throw new Error("Limite de cotacoes excedido.");
  }
};

const getProviderEnvironment = (baseUrl: string): "production" | "sandbox" => {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === "api-sandbox.asaas.com" ? "sandbox" : "production";
};

export const getPublicCoursePaymentQuote = async ({
  courseSlug,
  ipAddress,
}: {
  courseSlug: string;
  ipAddress: string;
}) => {
  const environment = getServerEnv();
  assertCheckoutAvailable({
    entry: "public",
    mode: environment.PAYMENTS_CHECKOUT_MODE,
  });
  if (!environment.ASAAS_API_BASE_URL) {
    throw new Error("Configuracao Asaas incompleta.");
  }
  const result = await getPool().query<PublicQuoteCourse>(
    `
      select c.id, c.price_in_cents, c.payment_allow_pix,
             c.payment_allow_credit_card, c.payment_max_installment_count,
             c.payment_card_pricing_policy
      from courses c
      where c.slug = $1
        and c.status = 'active'
        and c.price_in_cents >= 1000
        and exists (
          select 1 from course_publications cp
          where cp.course_id = c.id and cp.status = 'published'
        )
      limit 1
    `,
    [courseSlug]
  );
  const course = result.rows[0];
  if (!course) {
    throw new Error("Curso indisponivel.");
  }
  await authorizeQuoteRequest({
    courseId: course.id,
    ipAddress,
    secret: environment.BETTER_AUTH_SECRET,
  });
  const quote = await createCoursePaymentQuote({
    course: {
      allowCreditCard: course.payment_allow_credit_card,
      allowPix: course.payment_allow_pix,
      baseAmountInCents: course.price_in_cents,
      cardPricingPolicy: course.payment_card_pricing_policy,
      courseId: course.id,
      maxInstallmentCount: course.payment_max_installment_count,
    },
    gateway: getAsaasProviderClient(),
    providerEnvironment: getProviderEnvironment(environment.ASAAS_API_BASE_URL),
    repository: new PostgresPaymentQuoteRepository(),
  });
  return serializePublicPaymentQuote(quote);
};
