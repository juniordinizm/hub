import { describe, expect, it, vi } from "vitest";
import {
  isCompleteStagingResendLifecycle,
  type StagingResendLifecycleEvidence,
  verifyStagingResendLifecycle,
} from "./staging-resend-lifecycle";

const deliveredEvidence = (): StagingResendLifecycleEvidence => ({
  correlationId: "8e21a076-9fc7-4af4-8890-3e78891e0294",
  deliveryEventConflict: false,
  eventStatuses: ["processed", "processed"],
  eventTypes: ["email.delivered", "email.sent"],
  lastErrorCode: null,
  messageStatus: "delivered",
});

describe("Staging Resend lifecycle", () => {
  it("accepts only a fully processed sent and delivered timeline", () => {
    expect(isCompleteStagingResendLifecycle(deliveredEvidence())).toBe(true);
    expect(
      isCompleteStagingResendLifecycle({
        ...deliveredEvidence(),
        eventTypes: ["email.sent"],
        messageStatus: "accepted",
      })
    ).toBe(false);
    expect(
      isCompleteStagingResendLifecycle({
        ...deliveredEvidence(),
        deliveryEventConflict: true,
      })
    ).toBe(false);
  });

  it("polls the authenticated worker until the provider lifecycle converges", async () => {
    const accepted = { ...deliveredEvidence(), messageStatus: "accepted" };
    const readEvidence = vi
      .fn<() => Promise<StagingResendLifecycleEvidence | null>>()
      .mockResolvedValueOnce(accepted)
      .mockResolvedValueOnce(deliveredEvidence());
    const delay = vi.fn(async () => undefined);
    const runWebhookWorker = vi.fn(async () => 200);

    const evidence = await verifyStagingResendLifecycle({
      attempts: 3,
      dependencies: {
        delay,
        hasControlledAccount: async () => true,
        readEvidence,
        requestPasswordReset: async () => 200,
        runWebhookWorker,
      },
    });

    expect(evidence).toEqual(deliveredEvidence());
    expect(runWebhookWorker).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledOnce();
  });

  it("refuses to send when the controlled account is absent", async () => {
    const requestPasswordReset = vi.fn(async () => 200);

    await expect(
      verifyStagingResendLifecycle({
        attempts: 1,
        dependencies: {
          delay: async () => undefined,
          hasControlledAccount: async () => false,
          readEvidence: async () => null,
          requestPasswordReset,
          runWebhookWorker: async () => 200,
        },
      })
    ).rejects.toThrow("Controlled Staging account is not available.");
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("fails closed when the lifecycle never becomes delivered", async () => {
    await expect(
      verifyStagingResendLifecycle({
        attempts: 1,
        dependencies: {
          delay: async () => undefined,
          hasControlledAccount: async () => true,
          readEvidence: async () => ({
            ...deliveredEvidence(),
            eventStatuses: ["received"],
            eventTypes: ["email.sent"],
            messageStatus: "accepted",
          }),
          requestPasswordReset: async () => 200,
          runWebhookWorker: async () => 200,
        },
      })
    ).rejects.toThrow("Staging Resend lifecycle did not converge");
  });
});
