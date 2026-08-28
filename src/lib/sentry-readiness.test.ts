import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  withIsolationScope: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(),
  withIsolationScope: dependencies.withIsolationScope,
}));

import { emitSentryReadinessEvent } from "./sentry-readiness";

describe("Sentry readiness event", () => {
  beforeEach(() => {
    dependencies.withIsolationScope.mockImplementation((callback) =>
      callback({ setUser: vi.fn() })
    );
  });

  it("clears an inherited request user before emitting", async () => {
    const captureException = vi.fn().mockReturnValue("event-123");
    const flush = vi.fn().mockResolvedValue(true);
    const setUser = vi.fn();
    dependencies.withIsolationScope.mockImplementationOnce((callback) =>
      callback({ setUser })
    );

    await emitSentryReadinessEvent({
      captureException,
      environment: "staging",
      flush,
      release: "a".repeat(40),
    });

    expect(setUser).toHaveBeenCalledWith(null);
  });

  it("emits one constant PII-free exception with low-cardinality tags and flushes", async () => {
    const captureException = vi.fn().mockReturnValue("event-123");
    const flush = vi.fn().mockResolvedValue(true);

    await expect(
      emitSentryReadinessEvent({
        captureException,
        correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
        environment: "staging",
        flush,
        release: "a".repeat(40),
      })
    ).resolves.toEqual({
      correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
      eventId: "event-123",
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0] ?? [];
    expect(error).toMatchObject({
      message: "Synthetic Sentry readiness probe",
      name: "SentryReadinessProbeError",
    });
    expect(context).toEqual({
      tags: {
        environment: "staging",
        readiness_probe: "sentry",
        release: "a".repeat(40),
      },
    });
    expect(flush).toHaveBeenCalledWith(2000);
  });

  it("fails when Sentry cannot flush the event", async () => {
    await expect(
      emitSentryReadinessEvent({
        captureException: vi.fn().mockReturnValue("event-123"),
        correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
        environment: "production",
        flush: vi.fn().mockResolvedValue(false),
        release: "a".repeat(40),
      })
    ).rejects.toThrow("Sentry readiness event flush timed out.");
  });
});
