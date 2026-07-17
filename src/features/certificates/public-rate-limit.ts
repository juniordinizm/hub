import "server-only";
import { createHmac } from "node:crypto";
import { getPool } from "@/db";
import { getPublicCertificateRateLimitDecision } from "@/features/certificates/public-rate-limit-policy";
import { getServerEnv } from "@/lib/env";

const WINDOW_MS = 60_000;

const getRequestAddress = (requestHeaders: Headers): string =>
  requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  requestHeaders.get("x-real-ip") ||
  "unknown";

const hashAddress = (address: string): string =>
  createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(address)
    .digest("hex");

export const consumePublicCertificateLookup = async (
  requestHeaders: Headers
): Promise<"allowed" | "limited"> => {
  const keyHash = hashAddress(getRequestAddress(requestHeaders));
  const expiresAt = new Date(Date.now() + WINDOW_MS);
  const result = await getPool().query<{ request_count: number }>(
    `
      insert into public_certificate_rate_limits (
        key_hash,
        window_started_at,
        request_count,
        expires_at
      )
      values ($1, now(), 1, $2)
      on conflict (key_hash) do update set
        window_started_at = case
          when public_certificate_rate_limits.expires_at <= now() then now()
          else public_certificate_rate_limits.window_started_at
        end,
        request_count = case
          when public_certificate_rate_limits.expires_at <= now() then 1
          else public_certificate_rate_limits.request_count + 1
        end,
        expires_at = case
          when public_certificate_rate_limits.expires_at <= now() then excluded.expires_at
          else public_certificate_rate_limits.expires_at
        end,
        updated_at = now()
      returning request_count
    `,
    [keyHash, expiresAt]
  );

  return getPublicCertificateRateLimitDecision({
    requestCount: result.rows[0]?.request_count ?? Number.MAX_SAFE_INTEGER,
  });
};
