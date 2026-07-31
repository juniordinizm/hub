import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER =
  "x-protear-account-activation-idempotency";

const ACCOUNT_ACTIVATION_EMAIL_KEY_PREFIX = "auth-account-activation-v1-";
const ACCOUNT_ACTIVATION_EMAIL_KEY_PATTERN =
  /^auth-account-activation-v1-([a-f0-9]{64})-([a-f0-9]{64})$/;

export const isAccountActivationEmailIdempotencyKey = ({
  authSecret,
  value,
}: {
  authSecret: string;
  value: string;
}): boolean => {
  const match = ACCOUNT_ACTIVATION_EMAIL_KEY_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [, digest, authenticationTag] = match;
  if (!(digest && authenticationTag)) {
    return false;
  }
  const expectedTag = createDigest({
    authSecret,
    value: `account-activation-header:${digest}`,
  });
  return timingSafeEqual(
    Buffer.from(authenticationTag, "hex"),
    Buffer.from(expectedTag, "hex")
  );
};

const createDigest = ({
  authSecret,
  value,
}: {
  authSecret: string;
  value: string;
}): string => createHmac("sha256", authSecret).update(value).digest("hex");

export const deriveAccountActivationEmailIdempotencyKey = ({
  authSecret,
  outboxIdempotencyKey,
}: {
  authSecret: string;
  outboxIdempotencyKey: string;
}): string => {
  const digest = createDigest({
    authSecret,
    value: outboxIdempotencyKey,
  });
  const authenticationTag = createDigest({
    authSecret,
    value: `account-activation-header:${digest}`,
  });
  return `${ACCOUNT_ACTIVATION_EMAIL_KEY_PREFIX}${digest}-${authenticationTag}`;
};

export const getAccountActivationEmailIdempotencyKey = ({
  authSecret,
  request,
}: {
  authSecret: string;
  request?: Request;
}): string | undefined => {
  const headerValue = request?.headers.get(
    ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER
  );
  if (!headerValue) {
    return;
  }
  return isAccountActivationEmailIdempotencyKey({
    authSecret,
    value: headerValue,
  })
    ? headerValue
    : undefined;
};
