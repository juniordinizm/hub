import { describe, expect, it } from "vitest";
import {
  createCertificateIssuedMessage,
  createEnrollmentExpiryWarningMessage,
  createPaidAccessReleasedMessage,
  getRetryDelayMs,
  parseOutboxPayload,
} from "./rules";

const FORBIDDEN_PAYLOAD_KEY_PATTERN = /email|name|token|password|secret/i;

describe("outbox message contracts", () => {
  it("stores only stable identifiers in a certificate notification", () => {
    const message = createCertificateIssuedMessage({
      certificateId: "certificate-1",
    });

    expect(message).toEqual({
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "email.certificate-issued",
    });
    expect(JSON.stringify(message.payload)).not.toMatch(
      FORBIDDEN_PAYLOAD_KEY_PATTERN
    );
  });

  it("derives a unique paid-access notification from the order", () => {
    expect(
      createPaidAccessReleasedMessage({
        courseId: "course-1",
        orderId: "order-1",
        userId: "user-1",
      })
    ).toMatchObject({
      aggregateId: "order-1",
      aggregateType: "order",
      idempotencyKey: "email.access-released/order-1/v1",
      payload: { courseId: "course-1", userId: "user-1" },
      topic: "email.access-released",
    });
  });

  it("keeps the enrollment warning idempotent per warning window", () => {
    expect(
      createEnrollmentExpiryWarningMessage({
        enrollmentId: "enrollment-1",
        warningKind: "7d",
      })
    ).toMatchObject({
      idempotencyKey: "email.access-expiry-warning/enrollment-1/7d/v1",
      payload: { enrollmentId: "enrollment-1", warningKind: "7d" },
    });
  });

  it("rejects an unknown payload version without attempting delivery", () => {
    expect(() =>
      parseOutboxPayload({
        payload: { certificateId: "certificate-1" },
        payloadVersion: 2,
        topic: "email.certificate-issued",
      })
    ).toThrow("Versao de payload nao suportada");
  });

  it("backs off exponentially with bounded jitter", () => {
    expect(getRetryDelayMs({ attempt: 1, random: () => 0 })).toBe(60_000);
    expect(getRetryDelayMs({ attempt: 3, random: () => 1 })).toBe(270_000);
  });
});
