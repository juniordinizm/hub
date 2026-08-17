import { describe, expect, it, vi } from "vitest";
import {
  type ClaimedOutboxMessage,
  OutboxDeliveryError,
  processClaimedOutboxMessage,
} from "./worker";

const claimedMessage = (
  overrides: Partial<ClaimedOutboxMessage> = {}
): ClaimedOutboxMessage => ({
  aggregateId: "certificate-1",
  aggregateType: "certificate",
  attempts: 1,
  id: "outbox-1",
  idempotencyKey: "email.certificate-issued/certificate-1/v1",
  payload: { certificateId: "certificate-1" },
  payloadVersion: 1,
  topic: "email.certificate-issued",
  ...overrides,
});

describe("outbox worker", () => {
  it("marks a message delivered only after the adapter confirms it", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const markDelivered = vi.fn().mockResolvedValue(undefined);

    await expect(
      processClaimedOutboxMessage({
        deliver,
        markDeadLetter: vi.fn(),
        markDeferred: vi.fn(),
        markDelivered,
        markRetry: vi.fn(),
        message: claimedMessage(),
      })
    ).resolves.toBe("delivered");

    expect(deliver).toHaveBeenCalledWith(claimedMessage());
    expect(markDelivered).toHaveBeenCalledWith("outbox-1");
  });

  it("retries a transient provider failure with a bounded backoff", async () => {
    const markRetry = vi.fn().mockResolvedValue(undefined);

    await expect(
      processClaimedOutboxMessage({
        deliver: vi
          .fn()
          .mockRejectedValue(
            new OutboxDeliveryError("resend_unavailable", { retryable: true })
          ),
        markDeadLetter: vi.fn(),
        markDeferred: vi.fn(),
        markDelivered: vi.fn(),
        markRetry,
        message: claimedMessage({ attempts: 2 }),
        random: () => 0,
      })
    ).resolves.toBe("retrying");

    expect(markRetry).toHaveBeenCalledWith({
      errorCode: "resend_unavailable",
      id: "outbox-1",
      retryDelayMs: 120_000,
    });
  });

  it("dead-letters a permanent or exhausted delivery failure", async () => {
    const markDeadLetter = vi.fn().mockResolvedValue(undefined);

    await expect(
      processClaimedOutboxMessage({
        deliver: vi.fn().mockRejectedValue(
          new OutboxDeliveryError("unknown_payload_version", {
            retryable: false,
          })
        ),
        markDeadLetter,
        markDeferred: vi.fn(),
        markDelivered: vi.fn(),
        markRetry: vi.fn(),
        message: claimedMessage({ attempts: 5 }),
      })
    ).resolves.toBe("dead_letter");

    expect(markDeadLetter).toHaveBeenCalledWith({
      errorCode: "unknown_payload_version",
      id: "outbox-1",
    });
  });

  it("defers a temporarily ineligible aggregate without consuming attempts", async () => {
    const markDeferred = vi.fn().mockResolvedValue(undefined);
    const markRetry = vi.fn();

    await expect(
      processClaimedOutboxMessage({
        deliver: vi.fn().mockRejectedValue(
          new OutboxDeliveryError("course_sales_closed", {
            deferred: true,
            retryable: true,
          })
        ),
        markDeadLetter: vi.fn(),
        markDeferred,
        markDelivered: vi.fn(),
        markRetry,
        message: claimedMessage({ attempts: 5 }),
      })
    ).resolves.toBe("deferred");

    expect(markDeferred).toHaveBeenCalledWith({
      errorCode: "course_sales_closed",
      id: "outbox-1",
    });
    expect(markRetry).not.toHaveBeenCalled();
  });
});
