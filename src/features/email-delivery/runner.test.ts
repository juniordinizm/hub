import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  claimResendWebhookEvents: vi.fn(),
  connect: vi.fn(),
  getPool: vi.fn(),
  processResendWebhookEvent: vi.fn(),
  pruneEmailDeliveryRecords: vi.fn(),
  release: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("./worker", () => ({
  claimResendWebhookEvents: dependencies.claimResendWebhookEvents,
  processResendWebhookEvent: dependencies.processResendWebhookEvent,
}));
vi.mock("./server", async () => {
  const actual = await vi.importActual<typeof import("./server")>("./server");
  return {
    ...actual,
    pruneEmailDeliveryRecords: dependencies.pruneEmailDeliveryRecords,
  };
});

import { runResendWebhookWorker } from "./runner";

describe("Resend webhook runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({
      connect: dependencies.connect,
      query: vi.fn(),
    });
    dependencies.connect.mockResolvedValue({
      query: vi.fn(),
      release: dependencies.release,
    });
    dependencies.pruneEmailDeliveryRecords.mockResolvedValue({
      events: 2,
      messages: 1,
    });
  });

  it.each([
    ["processed", { processed: 1 }],
    ["ignored", { ignored: 1 }],
    ["retrying", { retried: 1 }],
    ["dead_letter", { deadLettered: 1 }],
  ] as const)("reports %s separately", async (outcome, expected) => {
    dependencies.claimResendWebhookEvents
      .mockResolvedValueOnce([{ id: "event-1" }])
      .mockResolvedValue([]);
    dependencies.processResendWebhookEvent.mockResolvedValue(outcome);

    await expect(
      runResendWebhookWorker({ limit: 1, workerId: "worker-a" })
    ).resolves.toMatchObject({
      ...expected,
      prunedEvents: 2,
      prunedMessages: 1,
    });
    expect(dependencies.release).toHaveBeenCalledOnce();
  });

  it("stops without claim or pruning after lease loss", async () => {
    await expect(
      runResendWebhookWorker({ shouldContinue: async () => false })
    ).resolves.toMatchObject({ leaseLost: true });
    expect(dependencies.claimResendWebhookEvents).not.toHaveBeenCalled();
    expect(dependencies.pruneEmailDeliveryRecords).not.toHaveBeenCalled();
  });
});
