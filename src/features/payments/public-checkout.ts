import "server-only";
import { createHmac } from "node:crypto";
import { getPool } from "@/db";
import type { AsaasGateway } from "@/features/payments/asaas";
import {
  type CheckoutIntentResult,
  type CreateAsaasCheckoutIntentInput,
  createAsaasCheckoutIntent,
  createCheckoutCallbacks,
} from "@/features/payments/checkout";
import { getAsaasProviderClient } from "@/features/payments/provider";
import { getServerEnv } from "@/lib/env";

const PUBLIC_CHECKOUT_WINDOW_SECONDS = 10 * 60;
const PUBLIC_CHECKOUT_MAX_ATTEMPTS = 5;
const PUBLIC_CHECKOUT_E2E_MAX_ATTEMPTS = 100;

export const getPublicCheckoutMaxAttempts = (isE2eTestMode: boolean): number =>
  isE2eTestMode
    ? PUBLIC_CHECKOUT_E2E_MAX_ATTEMPTS
    : PUBLIC_CHECKOUT_MAX_ATTEMPTS;

export class PublicCheckoutRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Muitas tentativas de checkout. Tente novamente em breve.");
    this.name = "PublicCheckoutRateLimitError";
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

interface RateLimitRow {
  expires_at: Date;
}

const getRateLimitKey = ({
  courseId,
  ipAddress,
  secret,
}: {
  courseId: string;
  ipAddress: string;
  secret: string;
}): string =>
  createHmac("sha256", secret)
    .update(ipAddress)
    .update("\0")
    .update(courseId)
    .digest("hex");

export const authorizePublicCheckoutIntent = async ({
  courseId,
  ipAddress,
  now = new Date(),
  maxAttempts = PUBLIC_CHECKOUT_MAX_ATTEMPTS,
  secret,
}: {
  courseId: string;
  ipAddress: string;
  maxAttempts?: number;
  now?: Date;
  secret: string;
}): Promise<void> => {
  const keyHash = getRateLimitKey({ courseId, ipAddress, secret });
  const consumed = await getPool().query<RateLimitRow>(
    `
      insert into public_checkout_rate_limits (
        key_hash, window_started_at, request_count, expires_at, created_at, updated_at
      )
      values (
        $1,
        $2::timestamptz,
        1,
        $2::timestamptz + interval '10 minutes',
        $2::timestamptz,
        $2::timestamptz
      )
      on conflict (key_hash) do update set
        window_started_at = case
          when public_checkout_rate_limits.expires_at <= $2::timestamptz
            then $2::timestamptz
          else public_checkout_rate_limits.window_started_at
        end,
        request_count = case
          when public_checkout_rate_limits.expires_at <= $2::timestamptz then 1
          else public_checkout_rate_limits.request_count + 1
        end,
        expires_at = case
          when public_checkout_rate_limits.expires_at <= $2::timestamptz
            then $2::timestamptz + interval '10 minutes'
          else public_checkout_rate_limits.expires_at
        end,
        updated_at = $2::timestamptz
      where public_checkout_rate_limits.expires_at <= $2::timestamptz
         or public_checkout_rate_limits.request_count < $3
      returning expires_at
    `,
    [keyHash, now, maxAttempts]
  );

  if (consumed.rows[0]) {
    return;
  }

  const current = await getPool().query<RateLimitRow>(
    `
      select expires_at
      from public_checkout_rate_limits
      where key_hash = $1
      limit 1
    `,
    [keyHash]
  );
  const expiresAt = current.rows[0]?.expires_at;
  const retryAfterSeconds = expiresAt
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)
    : PUBLIC_CHECKOUT_WINDOW_SECONDS;

  throw new PublicCheckoutRateLimitError(retryAfterSeconds);
};

export const createPublicCourseCheckout = async ({
  authenticatedBuyer,
  checkoutAttemptId,
  courseId,
  courseSlug,
  expectedContentReleaseScheduleDigest,
  gateway = getAsaasProviderClient(),
  ipAddress,
}: {
  authenticatedBuyer?: Extract<
    CreateAsaasCheckoutIntentInput["buyer"],
    { kind: "authenticated" }
  >;
  checkoutAttemptId: string;
  courseId?: string;
  courseSlug?: string;
  expectedContentReleaseScheduleDigest?: string;
  gateway?: AsaasGateway;
  ipAddress: string;
}): Promise<CheckoutIntentResult> => {
  const environment = getServerEnv();
  const secret = environment.BETTER_AUTH_SECRET;

  return await createAsaasCheckoutIntent({
    attemptId: checkoutAttemptId,
    authorizeNewIntent: async ({ courseId: canonicalCourseId }) =>
      await authorizePublicCheckoutIntent({
        courseId: canonicalCourseId,
        ipAddress,
        maxAttempts: getPublicCheckoutMaxAttempts(environment.E2E_TEST_MODE),
        secret,
      }),
    buyer: authenticatedBuyer ?? { kind: "provider_pending" },
    callbacks: createCheckoutCallbacks(checkoutAttemptId),
    ...(courseId ? { courseId } : {}),
    ...(courseSlug ? { courseSlug } : {}),
    ...(expectedContentReleaseScheduleDigest
      ? { expectedContentReleaseScheduleDigest }
      : {}),
    gateway,
  });
};
