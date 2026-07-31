import { describe, expect, it } from "vitest";
import {
  createAccountActivationMessage,
  createCertificateIssuedMessage,
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
