import { describe, expect, it } from "vitest";
import {
  type EmailDeliveryEvent,
  type EmailMessageStatus,
  mapResendEventType,
  projectEmailMessageStatus,
} from "./rules";

const event = (
  type: string,
  providerEventId = `event-${type}`
): EmailDeliveryEvent => ({
  occurredAt: "2026-08-24T12:00:00.000Z",
  providerEventId,
  type,
});

const permutations = <Value>(values: readonly Value[]): Value[][] => {
  if (values.length <= 1) {
    return [Array.from(values)];
  }
  const result: Value[][] = [];
  for (const [index, value] of values.entries()) {
    result.push(
      ...permutations(values.filter((_, itemIndex) => itemIndex !== index)).map(
        (tail) => [value, ...tail]
      )
    );
  }
  return result;
};

describe("Resend lifecycle mapping", () => {
  it.each([
    ["email.sent", "accepted"],
    ["email.delivery_delayed", "delayed"],
    ["email.delivered", "delivered"],
    ["email.failed", "failed"],
    ["email.suppressed", "suppressed"],
    ["email.bounced", "bounced"],
    ["email.complained", "complained"],
  ] as const)("maps %s to %s", (type, status) => {
    expect(mapResendEventType(type)).toBe(status);
  });

  it.each([
    "email.opened",
    "email.clicked",
    "email.received",
    "email.scheduled",
    "email.canceled",
    "email.future_type",
  ])("ignores %s", (type) => {
    expect(mapResendEventType(type)).toBeNull();
  });
});

describe("projectEmailMessageStatus", () => {
  it("honors the complete precedence independent of event order", () => {
    const events = [
      event("email.sent"),
      event("email.delivery_delayed"),
      event("email.failed"),
      event("email.suppressed"),
      event("email.bounced"),
      event("email.delivered"),
      event("email.complained"),
    ];
    for (const ordered of permutations(events)) {
      expect(
        projectEmailMessageStatus({
          events: ordered,
          localStatus: "acceptance_unknown",
        })
      ).toEqual({ conflict: true, status: "complained" });
    }
  });

  it.each([
    ["sending", [], "sending"],
    ["acceptance_unknown", [], "acceptance_unknown"],
    ["sending", [event("email.sent")], "accepted"],
    ["accepted", [event("email.delivery_delayed")], "delayed"],
    ["delivered", [event("email.failed")], "delivered"],
    ["bounced", [event("email.delivered")], "delivered"],
    ["delivered", [event("email.complained")], "complained"],
  ] as [
    EmailMessageStatus,
    EmailDeliveryEvent[],
    EmailMessageStatus,
  ][])("%s with events reduces to %s", (localStatus, events, status) => {
    expect(projectEmailMessageStatus({ events, localStatus }).status).toBe(
      status
    );
  });

  it("deduplicates provider event ids and detects conflicting terminal evidence", () => {
    expect(
      projectEmailMessageStatus({
        events: [
          event("email.failed", "event-1"),
          event("email.delivered", "event-1"),
        ],
        localStatus: "accepted",
      })
    ).toEqual({ conflict: false, status: "failed" });
    expect(
      projectEmailMessageStatus({
        events: [event("email.failed"), event("email.delivered")],
        localStatus: "accepted",
      })
    ).toEqual({ conflict: true, status: "delivered" });
  });

  it("rejects an invalid event timestamp even for an ignored type", () => {
    expect(() =>
      projectEmailMessageStatus({
        events: [{ ...event("email.opened"), occurredAt: "invalid" }],
        localStatus: "accepted",
      })
    ).toThrow("timestamp");
  });
});
