import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER,
  deriveAccountActivationEmailIdempotencyKey,
  getAccountActivationEmailIdempotencyKey,
} from "./account-activation-idempotency";

const DERIVED_KEY_PATTERN =
  /^auth-account-activation-v1-[a-f0-9]{64}-[a-f0-9]{64}$/;

describe("account activation email idempotency", () => {
  it("derives a stable opaque Resend key from the outbox key and auth secret", () => {
    const first = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });
    const repeated = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });
    const different = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-2/v1",
    });

    expect(first).toBe(repeated);
    expect(first).not.toBe(different);
    expect(first).toMatch(DERIVED_KEY_PATTERN);
    expect(first.length).toBeLessThanOrEqual(256);
    expect(first).not.toContain("order-1");
    expect(first).not.toContain("auth-secret");
  });

  it("accepts only a strictly valid derived key from the internal header", () => {
    const validKey = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });

    expect(
      getAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        request: new Request("https://hub.example.test", {
          headers: {
            [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: validKey,
          },
        }),
      })
    ).toBe(validKey);
    expect(
      getAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        request: new Request("https://hub.example.test", {
          headers: {
            [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]:
              "auth-account-activation-v1-order-1",
          },
        }),
      })
    ).toBeUndefined();
    expect(
      getAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        request: new Request("https://hub.example.test"),
      })
    ).toBeUndefined();
    expect(
      getAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        request: new Request("https://hub.example.test", {
          headers: {
            [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: `auth-account-activation-v1-${"a".repeat(64)}-${"b".repeat(64)}`,
          },
        }),
      })
    ).toBeUndefined();
  });
});
