import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/operations/background-drain", () => ({
  scheduleAfterResponse: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({
  createCorrelationId: vi.fn(() => "generated-correlation"),
}));
vi.mock("@/lib/observe-operation", () => ({
  observeOperation: vi.fn(),
}));
vi.mock("./outbox-job", () => ({ runOutboxJob: vi.fn() }));

import { scheduleOutboxDrainAfterResponse } from "./background-drain";

describe("scheduleOutboxDrainAfterResponse", () => {
  it("runs a bounded outbox drain after the response and observes failures", async () => {
    let callback: (() => void | Promise<void>) | undefined;
    const schedule = vi.fn((next: () => void | Promise<void>) => {
      callback = next;
    });
    const run = vi.fn().mockResolvedValue({ delivered: 1 });
    const observe = vi.fn(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );

    scheduleOutboxDrainAfterResponse({
      correlationId: "correlation-1",
      observe,
      run,
      schedule,
    });

    expect(schedule).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
    await callback?.();
    expect(run).toHaveBeenCalledWith({ deadlineMs: 15_000, limit: 5 });
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "correlation-1",
        failureErrorCode: "outbox_background_failed",
        operation: "outbox.background_drain",
      })
    );
  });

  it("does not reject the response callback when the background drain fails", async () => {
    let callback: (() => void | Promise<void>) | undefined;
    const failure = new Error("outbox unavailable");
    const schedule = vi.fn((next: () => void | Promise<void>) => {
      callback = next;
    });
    const run = vi.fn().mockRejectedValue(failure);
    const observe = vi.fn(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute()
    );

    scheduleOutboxDrainAfterResponse({ schedule, run, observe });

    await expect(callback?.()).resolves.toBeUndefined();
  });
});
