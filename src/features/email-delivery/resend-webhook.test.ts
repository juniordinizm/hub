import { describe, expect, it, vi } from "vitest";
import {
  normalizeResendWebhookEvent,
  persistResendWebhookEvent,
} from "./resend-webhook";

const rawBody = JSON.stringify({
  created_at: "2026-08-24T12:00:00.000Z",
  data: {
    email_id: "resend-message-1",
    from: "private@example.test",
    subject: "Private subject",
    tags: {
      hub_correlation: "0198d6f4-c2a5-7000-8000-000000000001",
      ignored_private: "student-1",
    },
    to: ["student@example.test"],
  },
  type: "email.delivered",
});
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

describe("normalizeResendWebhookEvent", () => {
  it("extracts only lifecycle metadata and hashes the raw body", () => {
    const normalized = normalizeResendWebhookEvent({
      providerEventId: "svix-event-1",
      rawBody,
      verifiedEvent: JSON.parse(rawBody) as unknown,
    });
    expect(normalized).toEqual({
      correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
      eventType: "email.delivered",
      occurredAt: new Date("2026-08-24T12:00:00.000Z"),
      payloadSha256: expect.stringMatching(SHA256_PATTERN),
      providerEventId: "svix-event-1",
      providerMessageId: "resend-message-1",
      status: "received",
    });
    expect(JSON.stringify(normalized)).not.toContain("student@example");
    expect(JSON.stringify(normalized)).not.toContain("Private subject");
    expect(JSON.stringify(normalized)).not.toContain("ignored_private");
  });

  it("keeps ignored email event types processable but dead-letters invalid signed schema", () => {
    expect(
      normalizeResendWebhookEvent({
        providerEventId: "svix-event-2",
        rawBody,
        verifiedEvent: {
          ...JSON.parse(rawBody),
          type: "email.opened",
        },
      }).status
    ).toBe("received");
    expect(
      normalizeResendWebhookEvent({
        providerEventId: "svix-event-3",
        rawBody: "{}",
        verifiedEvent: { type: "email.delivered" },
      })
    ).toMatchObject({
      eventType: "invalid",
      lastErrorCode: "invalid_event_schema",
      providerEventId: "svix-event-3",
      providerMessageId: null,
      status: "dead_letter",
    });
  });
});

describe("persistResendWebhookEvent", () => {
  it("inserts the minimal envelope idempotently by svix id", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: "local-event-1" }] });
    const event = normalizeResendWebhookEvent({
      providerEventId: "svix-event-1",
      rawBody,
      verifiedEvent: JSON.parse(rawBody) as unknown,
    });
    await expect(
      persistResendWebhookEvent({ client: { query } as never, event })
    ).resolves.toEqual({ id: "local-event-1", inserted: true });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (provider_event_id) do nothing"),
      expect.arrayContaining([
        "svix-event-1",
        "resend-message-1",
        "email.delivered",
      ])
    );
    expect(JSON.stringify(query.mock.calls)).not.toContain("student@example");
  });
});
