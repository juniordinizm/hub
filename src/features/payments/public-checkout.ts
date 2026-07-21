import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { buildAbacatePayCheckoutRequest } from "@/features/payments/abacatepay";
import {
  getAbacatePayProviderClient,
  getApplicationUrl,
} from "@/features/payments/provider";

const PUBLIC_CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_CHECKOUT_MAX_ATTEMPTS = 5;

interface PublicCheckoutRateLimitState {
  count: number;
  resetAt: number;
}

interface PublicCourseCheckoutResult {
  redirectUrl: string;
}

interface PublicCheckoutCourse {
  access_duration_months: number;
  id: string;
  payment_provider_product_id: string | null;
  price_in_cents: number;
  slug: string;
  status: string;
}

const publicCheckoutRateLimitState = new Map<
  string,
  PublicCheckoutRateLimitState
>();

export class PublicCheckoutRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Muitas tentativas de checkout. Tente novamente em breve.");
    this.name = "PublicCheckoutRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const consumePublicCheckoutAttempt = ({
  courseKey,
  ipAddress,
}: {
  courseKey: string;
  ipAddress: string;
}): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
  const key = `${ipAddress}:${courseKey}`;
  const timestamp = Date.now();
  const current = publicCheckoutRateLimitState.get(key);

  if (!current || current.resetAt <= timestamp) {
    publicCheckoutRateLimitState.set(key, {
      count: 1,
      resetAt: timestamp + PUBLIC_CHECKOUT_WINDOW_MS,
    });
    return { allowed: true };
  }

  if (current.count >= PUBLIC_CHECKOUT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - timestamp) / 1000),
    };
  }

  current.count += 1;
  publicCheckoutRateLimitState.set(key, current);
  return { allowed: true };
};

const getPublicCheckoutCourse = async ({
  courseId,
  courseSlug,
}: {
  courseId?: string;
  courseSlug?: string;
}): Promise<PublicCheckoutCourse> => {
  if (!(courseId || courseSlug)) {
    throw new Error("Informe o curso para iniciar o checkout.");
  }

  const { rows } = await getPool().query<PublicCheckoutCourse>(
    `
      select id, slug, payment_provider_product_id, price_in_cents, access_duration_months, status
      from courses
      where ($1::uuid is not null and id = $1::uuid)
         or ($2::text is not null and slug = $2::text)
      limit 1
    `,
    [courseId ?? null, courseSlug ?? null]
  );
  const course = rows[0];

  if (course?.status !== "active") {
    throw new Error("Curso indisponivel para compra.");
  }

  if (!course.payment_provider_product_id) {
    throw new Error("Curso sem produto AbacatePay configurado.");
  }

  if (course.price_in_cents <= 0) {
    throw new Error("Curso sem preco configurado.");
  }

  return course;
};

export const createPublicCourseCheckout = async ({
  courseId,
  courseSlug,
  ipAddress,
}: {
  courseId?: string;
  courseSlug?: string;
  ipAddress: string;
}): Promise<PublicCourseCheckoutResult> => {
  const course = await getPublicCheckoutCourse({
    ...(courseId ? { courseId } : {}),
    ...(courseSlug ? { courseSlug } : {}),
  });
  const rateLimit = consumePublicCheckoutAttempt({
    courseKey: course.id,
    ipAddress,
  });

  if (!rateLimit.allowed) {
    throw new PublicCheckoutRateLimitError(rateLimit.retryAfterSeconds);
  }

  const productId = course.payment_provider_product_id;

  if (!productId) {
    throw new Error("Curso sem produto AbacatePay configurado.");
  }

  const externalId = `order_${randomUUID()}`;
  const checkout = await getAbacatePayProviderClient().createCheckout(
    buildAbacatePayCheckoutRequest({
      accessDurationMonths: course.access_duration_months,
      completionUrl: getApplicationUrl(
        `/checkout/sucesso?courseId=${encodeURIComponent(course.id)}`
      ),
      courseId: course.id,
      externalId,
      productId,
      returnUrl: getApplicationUrl("/entrar"),
      source: "landing",
    })
  );

  await getPool().query(
    `
      insert into orders (
        course_id,
        provider_order_id,
        external_id,
        status,
        amount_in_cents,
        access_duration_months
      )
      values ($1, $2, $3, 'pending', $4, $5)
      on conflict (provider, provider_order_id) do update set
        external_id = excluded.external_id,
        amount_in_cents = excluded.amount_in_cents,
        access_duration_months = excluded.access_duration_months,
        updated_at = now()
    `,
    [
      course.id,
      checkout.id,
      externalId,
      course.price_in_cents,
      course.access_duration_months,
    ]
  );

  return { redirectUrl: checkout.url };
};
