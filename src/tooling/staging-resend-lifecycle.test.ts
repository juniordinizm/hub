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
        readEvidence,
        runWebhookWorker,
        startLifecycle: async () => ({
          correlationId: deliveredEvidence().correlationId,
          status: 200,
        }),
      },
    });

    expect(evidence).toEqual(deliveredEvidence());
    expect(runWebhookWorker).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledOnce();
  });

  it("refuses to poll when the readiness route fails", async () => {
    const runWebhookWorker = vi.fn(async () => 200);
    await expect(
      verifyStagingResendLifecycle({
        attempts: 1,
        dependencies: {
          delay: async () => undefined,
          readEvidence: async () => null,
          runWebhookWorker,
          startLifecycle: async () => ({ status: 503 }),
        },
      })
    ).rejects.toThrow("Staging Resend readiness request failed.");
    expect(runWebhookWorker).not.toHaveBeenCalled();
  });

  it("fails closed when the lifecycle never becomes delivered", async () => {
    await expect(
      verifyStagingResendLifecycle({
        attempts: 1,
        dependencies: {
          delay: async () => undefined,
          readEvidence: async () => ({
            ...deliveredEvidence(),
            eventStatuses: ["received"],
            eventTypes: ["email.sent"],
            messageStatus: "accepted",
          }),
          runWebhookWorker: async () => 200,
          startLifecycle: async () => ({
            correlationId: deliveredEvidence().correlationId,
            status: 200,
          }),
        },
      })
    ).rejects.toThrow("Staging Resend lifecycle did not converge");
  });
});
