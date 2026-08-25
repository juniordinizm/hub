import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  after: vi.fn(),
  createCorrelationId: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: dependencies.after,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
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

let afterCallbacks: Array<() => void | Promise<void>> = [];

const flushAfterCallbacks = async (): Promise<void> => {
  const callbacks = afterCallbacks;
  afterCallbacks = [];
  for (const callback of callbacks) {
    await callback();
  }
};

describe("Better Auth password reset email callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    afterCallbacks = [];
    dependencies.after.mockImplementation(
      (callback: () => void | Promise<void>) => {
        afterCallbacks.push(callback);
      }
    );
    dependencies.createCorrelationId.mockReturnValue(
      "fbe7b6eb-e066-4b41-970a-f4ea65ca1772"
    );
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
    });
  });

  it("schedules a public reset after the response without sending before flush", async () => {
    const request = new Request(
      "https://auth.example.test/request-password-reset",
      {
        headers: {
          "x-correlation-id": "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        },
      }
    );

    await expect(
      sendBetterAuthPasswordResetEmail(
        {
          url: "https://auth.example.test/reset/public-token",
          user: {
            email: "public@example.test",
            name: "Public Student",
          },
        },
        request
      )
    ).resolves.toBeUndefined();

    expect(dependencies.after).toHaveBeenCalledTimes(1);
    expect(dependencies.sendPasswordResetEmail).not.toHaveBeenCalled();

    await flushAfterCallbacks();

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      deliveryContext: {
        correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        idempotencyKey:
          "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
        topic: "auth.password-reset",
      },
      idempotencyKey:
        "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
      resetUrl: "https://auth.example.test/reset/public-token",
      to: "public@example.test",
      userName: "Public Student",
    });
    expect(dependencies.createCorrelationId).toHaveBeenCalledWith(
      "fbe7b6eb-e066-4b41-970a-f4ea65ca1772"
    );
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

    expect(dependencies.after).toHaveBeenCalledTimes(1);
    expect(dependencies.sendPasswordResetEmail).not.toHaveBeenCalled();

    await flushAfterCallbacks();

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      deliveryContext: {
        correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
        idempotencyKey:
          "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
        topic: "auth.password-reset",
      },
      idempotencyKey:
        "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
      resetUrl: "https://auth.example.test/reset/token",
      to: "student@example.test",
      userName: "Student",
    });
  });

  it("records a successful internal delivery with the derived key", async () => {
    const resetUrl = "https://auth.example.test/reset/private-token";
    const to = "private@example.test";
    const userName = "Private Student";
    const idempotencyKey = deriveAccountActivationEmailIdempotencyKey({
      authSecret: "auth-secret",
      outboxIdempotencyKey: "auth.account-activation/order-1/v1",
    });
    dependencies.sendPasswordResetEmail.mockResolvedValue(undefined);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    try {
      await expect(
        runWithAccountActivationDeliveryContext({
          idempotencyKey,
          operation: () =>
            sendBetterAuthPasswordResetEmail(
              {
                url: resetUrl,
                user: {
                  email: to,
                  name: userName,
                },
              },
              new Request("https://auth.example.test/request-password-reset", {
                headers: {
                  [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: idempotencyKey,
                },
              })
            ),
        })
      ).resolves.toBe(true);

      expect(dependencies.after).not.toHaveBeenCalled();

      const output = [...consoleError.mock.calls, ...consoleInfo.mock.calls]
        .flat()
        .join(" ");
      expect(output).not.toContain(to);
      expect(output).not.toContain(resetUrl);
    } finally {
      consoleError.mockRestore();
      consoleInfo.mockRestore();
    }

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith({
      idempotencyKey,
      resetUrl,
      to,
      userName,
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

    if (request) {
      expect(dependencies.after).toHaveBeenCalledTimes(1);
      await flushAfterCallbacks();
    } else {
      expect(dependencies.after).not.toHaveBeenCalled();
    }

    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith(
      request
        ? {
            deliveryContext: {
              correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
              idempotencyKey:
                "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
              topic: "auth.password-reset",
            },
            idempotencyKey:
              "auth.password-reset/fbe7b6eb-e066-4b41-970a-f4ea65ca1772/v1",
            resetUrl: "https://auth.example.test/reset/token",
            to: "student@example.test",
            userName: "Student",
          }
        : {
            resetUrl: "https://auth.example.test/reset/token",
            to: "student@example.test",
            userName: "Student",
          }
    );
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
    expect(dependencies.after).not.toHaveBeenCalled();
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

  it("keeps requestless reset delivery synchronous", async () => {
    const providerError = new Error(
      "Resend failed for internal@example.test at https://auth.example.test/reset/internal-token"
    );
    dependencies.sendPasswordResetEmail.mockRejectedValue(providerError);

    await expect(
      sendBetterAuthPasswordResetEmail({
        url: "https://auth.example.test/reset/internal-token",
        user: {
          email: "internal@example.test",
          name: "Internal Student",
        },
      })
    ).rejects.toBe(providerError);

    expect(dependencies.after).not.toHaveBeenCalled();
  });

  it("captures and logs a scheduled public delivery failure without throwing", async () => {
    const providerError = new Error(
      "Resend failed for public@example.test at https://auth.example.test/reset/public-token"
    );
    dependencies.sendPasswordResetEmail.mockRejectedValue(providerError);

    await expect(
      sendBetterAuthPasswordResetEmail(
        {
          url: "https://auth.example.test/reset/public-token",
          user: {
            email: "public@example.test",
            name: "Public Student",
          },
        },
        new Request("https://auth.example.test/request-password-reset", {
          headers: {
            "x-correlation-id": "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
          },
        })
      )
    ).resolves.toBeUndefined();

    await expect(flushAfterCallbacks()).resolves.toBeUndefined();

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      correlationId: "fbe7b6eb-e066-4b41-970a-f4ea65ca1772",
      errorCode: "password_reset_email_delivery_failed",
      operation: "auth.password_reset",
      outcome: "failure",
      provider: "resend",
    });
    const loggedEvent = dependencies.logOperationalEvent.mock.calls[0]?.[0];
    expect(JSON.stringify(loggedEvent)).not.toContain("public@example.test");
    expect(JSON.stringify(loggedEvent)).not.toContain("Public Student");
    expect(JSON.stringify(loggedEvent)).not.toContain("public-token");
    expect(JSON.stringify(loggedEvent)).not.toContain(providerError.message);
  });
});
