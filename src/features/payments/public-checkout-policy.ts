const PUBLIC_CHECKOUT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_CHECKOUT_MAX_ATTEMPTS = 5;

interface PublicCheckoutRateLimitState {
  count: number;
  resetAt: number;
}

export interface PublicCheckoutRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export const normalizeBuyerEmail = (email: string): string =>
  email.trim().toLowerCase();

export const getPublicCheckoutRateLimitDecision = ({
  courseKey,
  ipAddress,
  now = new Date(),
  state,
}: {
  courseKey: string;
  ipAddress: string;
  now?: Date;
  state: Map<string, PublicCheckoutRateLimitState>;
}): PublicCheckoutRateLimitDecision => {
  const key = `${ipAddress}:${courseKey}`;
  const timestamp = now.getTime();
  const current = state.get(key);

  if (!current || current.resetAt <= timestamp) {
    state.set(key, {
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
  state.set(key, current);
  return { allowed: true };
};
