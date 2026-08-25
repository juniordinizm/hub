import { describe, expect, it, vi } from "vitest";
import {
  beginEmailDeliveryAttempt,
  buildResendLifecycleTags,
  createEmailRequestFingerprint,
  type EmailDeliveryContext,
  markEmailAcceptanceUnknown,
  markEmailAccepted,
} from "./server";

const context: EmailDeliveryContext = {
  correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
  idempotencyKey: "email.certificate-issued/certificate-1/v1",
  outboxMessageId: "0198d6f4-c2a5-7000-8000-000000000001",
  templateAlias: "certificate-issued",
  topic: "email.certificate-issued",
};
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

describe("email request fingerprint and tags", () => {
  it("creates a stable HMAC over canonical content without returning the request", () => {
    const first = createEmailRequestFingerprint({
      authSecret: "secret-at-least-32-characters-long",
      request: {
        template: { id: "certificate-issued", variables: { B: 2, A: 1 } },
        to: "private@example.test",
      },
    });
    const second = createEmailRequestFingerprint({
      authSecret: "secret-at-least-32-characters-long",
      request: {
        to: "private@example.test",
        template: { variables: { A: 1, B: 2 }, id: "certificate-issued" },
      },
    });
    expect(first).toBe(second);
    expect(first).toMatch(SHA256_PATTERN);
    expect(first).not.toContain("private");
  });

  it("maps closed topics to bounded ASCII tags and rejects invalid context", () => {
    expect(buildResendLifecycleTags(context)).toEqual([
      { name: "hub_topic", value: "email_certificate_issued" },
      {
        name: "hub_correlation",
        value: "0198d6f4-c2a5-7000-8000-000000000001",
      },
    ]);
    expect(() =>
      buildResendLifecycleTags({ ...context, topic: "email.future" as never })
    ).toThrow("topic");
    expect(() =>
      buildResendLifecycleTags({ ...context, correlationId: "student-1" })
    ).toThrow("correlation");
  });
});

describe("durable email acceptance window", () => {
  it("records the first attempt with a 23-hour database deadline before IO", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            accepted_at: null,
            automatic_retry_deadline_at: null,
            database_now: new Date("2026-08-24T12:00:00.000Z"),
            first_provider_attempt_at: null,
            id: context.correlationId,
            provider_message_id: null,
            request_fingerprint: "a".repeat(64),
            status: "sending",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      beginEmailDeliveryAttempt({
        client: { query } as never,
        context,
        requestFingerprint: "a".repeat(64),
      })
    ).resolves.toEqual({
      action: "send",
      emailMessageId: context.correlationId,
    });
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "insert into email_messages"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain("for update");
    expect(String(query.mock.calls[2]?.[0])).toContain("interval '23 hours'");
  });

  it("returns accepted without IO when a provider id is already known", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            accepted_at: new Date("2026-08-24T11:59:00.000Z"),
            automatic_retry_deadline_at: new Date("2026-08-25T11:00:00.000Z"),
            database_now: new Date("2026-08-24T12:00:00.000Z"),
            first_provider_attempt_at: new Date("2026-08-24T12:00:00.000Z"),
            id: context.correlationId,
            provider_message_id: "resend-message-1",
            request_fingerprint: "a".repeat(64),
            status: "accepted",
          },
        ],
      });
    await expect(
      beginEmailDeliveryAttempt({
        client: { query } as never,
        context,
        requestFingerprint: "a".repeat(64),
      })
    ).resolves.toEqual({
      action: "accepted",
      acceptedAt: new Date("2026-08-24T11:59:00.000Z"),
      emailMessageId: context.correlationId,
      providerMessageId: "resend-message-1",
    });
  });

  it.each([
    [
      "fingerprint mismatch",
      "b".repeat(64),
      new Date("2026-08-25T11:00:00.000Z"),
    ],
    ["deadline elapsed", "a".repeat(64), new Date("2026-08-24T11:59:59.000Z")],
  ])("keeps acceptance unknown on %s", async (_label, requestFingerprint, deadline) => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            accepted_at: null,
            automatic_retry_deadline_at: deadline,
            database_now: new Date("2026-08-24T12:00:00.000Z"),
            first_provider_attempt_at: new Date("2026-08-24T10:00:00.000Z"),
            id: context.correlationId,
            provider_message_id: null,
            request_fingerprint: "a".repeat(64),
            status: "acceptance_unknown",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      beginEmailDeliveryAttempt({
        client: { query } as never,
        context,
        requestFingerprint,
      })
    ).resolves.toEqual({
      action: "unresolved",
      emailMessageId: context.correlationId,
    });
    expect(String(query.mock.calls[2]?.[0])).toContain(
      "resend_acceptance_unresolved"
    );
  });

  it("persists only provider acceptance metadata or a sanitized unknown code", async () => {
    const acceptedAt = new Date("2026-08-24T12:00:00.000Z");
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ accepted_at: acceptedAt }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(
      markEmailAccepted({
        client: { query } as never,
        emailMessageId: context.correlationId,
        providerMessageId: "resend-message-1",
      })
    ).resolves.toEqual({ acceptedAt });
    await expect(
      markEmailAcceptanceUnknown({
        client: { query } as never,
        emailMessageId: context.correlationId,
      })
    ).resolves.toBe(true);
    expect(JSON.stringify(query.mock.calls)).not.toContain("private@example");
  });
});
