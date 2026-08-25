import { describe, expect, it, vi } from "vitest";
import {
  type ClaimedResendWebhookEvent,
  claimResendWebhookEvents,
  processResendWebhookEvent,
} from "./worker";

const claimed = (
  overrides: Partial<ClaimedResendWebhookEvent> = {}
): ClaimedResendWebhookEvent => ({
  attempts: 1,
  correlationId: "0198d6f4-c2a5-7000-8000-000000000001",
  eventType: "email.delivered",
  id: "0198d6f4-c2a5-7000-8000-000000000002",
  occurredAt: new Date("2026-08-24T12:00:00.000Z"),
  providerEventId: "svix-event-1",
  providerMessageId: "resend-message-1",
  ...overrides,
});

describe("Resend webhook worker", () => {
  it("claims ready events with skip locked and a fenced lease", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await claimResendWebhookEvents({
      client: { query } as never,
      limit: 10,
      workerId: "resend-worker-a",
    });
    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("for update skip locked");
    expect(statement).toContain("status in ('received', 'retrying')");
    expect(statement).toContain("status = 'processing'");
  });

  it("projects a valid event and marks it processed in one transaction", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "0198d6f4-c2a5-7000-8000-000000000001",
            status: "accepted",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_type: "email.delivered",
            occurred_at: new Date("2026-08-24T12:00:00.000Z"),
            provider_event_id: "svix-event-1",
          },
        ],
      })
      .mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      processResendWebhookEvent({
        client: { query } as never,
        event: claimed(),
        workerId: "resend-worker-a",
      })
    ).resolves.toBe("processed");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("update email_messages")
      )
    ).toBe(true);
    const projectionUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("update email_messages")
    );
    expect(String(projectionUpdate?.[0])).toContain(
      "greatest(coalesce(latest_event_at, $4), $4)"
    );
    expect(
      query.mock.calls.some(
        ([sql, parameters]) =>
          String(sql).includes("update resend_webhook_events") &&
          Array.isArray(parameters) &&
          parameters.includes("processed")
      )
    ).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe("commit");
  });

  it("marks ignored types without changing the email projection", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "0198d6f4-c2a5-7000-8000-000000000001",
            status: "accepted",
          },
        ],
      })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(
      processResendWebhookEvent({
        client: { query } as never,
        event: claimed({ eventType: "email.opened" }),
        workerId: "resend-worker-a",
      })
    ).resolves.toBe("ignored");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("update email_messages")
      )
    ).toBe(false);
  });

  it.each([
    [1, "retrying"],
    [12, "dead_letter"],
  ] as const)("keeps an unmatched event at attempt %i as %s", async (attempts, outcome) => {
    const occurredAt = new Date(Date.now() - 60_000);
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(
      processResendWebhookEvent({
        client: { query } as never,
        event: claimed({ attempts, occurredAt }),
        workerId: "resend-worker-a",
      })
    ).resolves.toBe(outcome);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes(`status = '${outcome}'`)
      )
    ).toBe(true);
  });
});
