import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/features/email/server", () => ({
  sendPasswordResetEmail: dependencies.sendPasswordResetEmail,
}));

import { runWithAccountActivationDeliveryContext } from "./account-activation-delivery-context";
import {
  ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER,
  deriveAccountActivationEmailIdempotencyKey,
} from "./account-activation-idempotency";
import { sendBetterAuthPasswordResetEmail } from "./auth-password-reset";

describe("Better Auth password reset email callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
    });
  });

  it("does not trust a valid activation header without its request-scoped context", async () => {
    const idempotencyKey = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });

    await sendBetterAuthPasswordResetEmail(
      {
        url: "https://auth.example.test/reset/token",
        user: {
          email: "student@example.test",
          name: "Student",
        },
      },
      new Request("https://auth.example.test/request-password-reset", {
        headers: {
          [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      })
    );

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.test",
      userName: "Student",
    });
  });

  it.each([
    undefined,
    new Request("https://auth.example.test/request-password-reset", {
      headers: {
        [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: "attacker-controlled",
      },
    }),
  ])("omits an absent or invalid internal key", async (request) => {
    await sendBetterAuthPasswordResetEmail(
      {
        url: "https://auth.example.test/reset/token",
        user: {
          email: "student@example.test",
          name: "Student",
        },
      },
      request
    );

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.test",
      userName: "Student",
    });
  });

  it("sanitizes an internal delivery failure while recording the failed outcome", async () => {
    const idempotencyKey = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });
    const providerError = new Error(
      "Resend failed for private@example.test at https://auth.example.test/reset/private-token"
    );
    dependencies.sendPasswordResetEmail.mockRejectedValue(providerError);
    let callbackError: unknown;

    const delivered = await runWithAccountActivationDeliveryContext({
      idempotencyKey,
      operation: async () => {
        try {
          await sendBetterAuthPasswordResetEmail(
            {
              url: "https://auth.example.test/reset/private-token",
              user: {
                email: "private@example.test",
                name: "Private Student",
              },
            },
            new Request("https://auth.example.test/request-password-reset", {
              headers: {
                [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: idempotencyKey,
              },
            })
          );
        } catch (error) {
          callbackError = error;
        }
      },
    });

    expect(delivered).toBe(false);
    expect(callbackError).toBeInstanceOf(Error);
    if (!(callbackError instanceof Error)) {
      throw new Error("Expected a sanitized callback error.");
    }
    expect(callbackError.message).toBe(
      "account_activation_email_delivery_failed"
    );
    expect(callbackError.message).not.toContain("private@example.test");
    expect(callbackError.message).not.toContain("private-token");
    expect(callbackError.cause).toBeUndefined();
    expect(callbackError).not.toBe(providerError);
  });

  it("preserves the original failure for a public password reset", async () => {
    const providerError = new Error(
      "Resend failed for public@example.test at https://auth.example.test/reset/public-token"
    );
    dependencies.sendPasswordResetEmail.mockRejectedValue(providerError);

    await expect(
      sendBetterAuthPasswordResetEmail({
        url: "https://auth.example.test/reset/public-token",
        user: {
          email: "public@example.test",
          name: "Public Student",
        },
      })
    ).rejects.toBe(providerError);
  });
});
