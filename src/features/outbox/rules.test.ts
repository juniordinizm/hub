import { describe, expect, it } from "vitest";
import {
  createAccountActivationMessage,
  createCertificateIssuedMessage,
  createCheckoutCancellationMessage,
  createCourseSalesOpenedMessage,
  createEnrollmentExpiryWarningMessage,
  createPaidAccessReleasedMessage,
  getRetryDelayMs,
  parseOutboxPayload,
} from "./rules";

const FORBIDDEN_PAYLOAD_KEY_PATTERN = /email|name|token|password|secret/i;
const ACTIVATION_FORBIDDEN_PAYLOAD_KEY_PATTERN =
  /email|name|token|password|url|courseId/i;

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
    const message = createPaidAccessReleasedMessage({
      courseId: "course-1",
      orderId: "order-1",
      userId: "user-1",
    });

    expect(message).toEqual({
      aggregateId: "order-1",
      aggregateType: "order",
      idempotencyKey: "email.access-released/order-1/v1",
      payload: { courseId: "course-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "email.access-released",
    });
    expect(parseOutboxPayload(message)).toEqual({
      courseId: "course-1",
      userId: "user-1",
    });
    expect(Object.keys(message.payload).join(",")).not.toMatch(
      FORBIDDEN_PAYLOAD_KEY_PATTERN
    );
  });

  it("stores an activation intent with exactly the local account and order ids", () => {
    const message = createAccountActivationMessage({
      orderId: "order-1",
      userId: "user-1",
    });

    expect(message).toEqual({
      aggregateId: "order-1",
      aggregateType: "order",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });
    expect(Object.keys(message.payload).sort()).toEqual(["orderId", "userId"]);
    expect(JSON.stringify(message.payload)).not.toMatch(
      ACTIVATION_FORBIDDEN_PAYLOAD_KEY_PATTERN
    );
    expect(
      parseOutboxPayload({
        payload: message.payload,
        payloadVersion: message.payloadVersion,
        topic: message.topic,
      })
    ).toEqual({ orderId: "order-1", userId: "user-1" });
    expect(() =>
      parseOutboxPayload({
        payload: {
          email: "private@example.test",
          orderId: "order-1",
          userId: "user-1",
        },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).toThrow("Versao de payload nao suportada");
    expect(() =>
      parseOutboxPayload({
        payload: message.payload,
        payloadVersion: 2,
        topic: message.topic,
      })
    ).toThrow("Versao de payload nao suportada");
    expect(() =>
      parseOutboxPayload({
        payload: message.payload,
        payloadVersion: 1,
        topic: "email.access-released",
      })
    ).toThrow("Versao de payload nao suportada");
  });

  it.each([
    "1d",
    "7d",
  ] as const)("keeps the enrollment warning idempotent per %s warning window", (warningKind) => {
    const message = createEnrollmentExpiryWarningMessage({
      enrollmentId: "enrollment-1",
      warningKind,
    });

    expect(message).toEqual({
      aggregateId: "enrollment-1",
      aggregateType: "enrollment",
      idempotencyKey: `email.access-expiry-warning/enrollment-1/${warningKind}/v1`,
      payload: { enrollmentId: "enrollment-1", warningKind },
      payloadVersion: 1,
      topic: "email.access-expiry-warning",
    });
    expect(parseOutboxPayload(message)).toEqual({
      enrollmentId: "enrollment-1",
      warningKind,
    });
    expect(Object.keys(message.payload).join(",")).not.toMatch(
      FORBIDDEN_PAYLOAD_KEY_PATTERN
    );
  });

  it("keeps a course sales notification bound to one interest activation", () => {
    const message = createCourseSalesOpenedMessage({
      interestId: "interest-1",
    });

    expect(message).toEqual({
      aggregateId: "interest-1",
      aggregateType: "course_interest",
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
      payload: { interestId: "interest-1" },
      payloadVersion: 1,
      topic: "email.course-sales-opened",
    });
    expect(parseOutboxPayload(message)).toEqual({ interestId: "interest-1" });
    expect(JSON.stringify(message.payload)).not.toMatch(
      FORBIDDEN_PAYLOAD_KEY_PATTERN
    );
  });

  it("cancels one external checkout through a durable order intent", () => {
    const message = createCheckoutCancellationMessage({ orderId: "order-1" });

    expect(message).toEqual({
      aggregateId: "order-1",
      aggregateType: "order",
      idempotencyKey: "payments.checkout-cancel/order-1/v1",
      payload: { orderId: "order-1" },
      payloadVersion: 1,
      topic: "payments.checkout-cancel",
    });
    expect(parseOutboxPayload(message)).toEqual({ orderId: "order-1" });
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
