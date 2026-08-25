export type EmailMessageStatus =
  | "acceptance_unknown"
  | "accepted"
  | "bounced"
  | "complained"
  | "delayed"
  | "delivered"
  | "failed"
  | "sending"
  | "suppressed";

export interface EmailDeliveryEvent {
  occurredAt: string;
  providerEventId: string;
  type: string;
}

const EVENT_STATUS: Readonly<Record<string, EmailMessageStatus>> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
  "email.sent": "accepted",
  "email.suppressed": "suppressed",
};

const STATUS_PRECEDENCE: Readonly<Record<EmailMessageStatus, number>> = {
  acceptance_unknown: 2,
  accepted: 3,
  bounced: 7,
  complained: 9,
  delayed: 4,
  delivered: 8,
  failed: 5,
  sending: 1,
  suppressed: 6,
};

const CONFLICT_STATUSES = new Set<EmailMessageStatus>([
  "bounced",
  "delivered",
  "failed",
  "suppressed",
]);

export const mapResendEventType = (type: string): EmailMessageStatus | null =>
  EVENT_STATUS[type] ?? null;

const assertValidTimestamp = (value: string): void => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error("Resend event timestamp is invalid.");
  }
};

export const projectEmailMessageStatus = ({
  events,
  localStatus,
}: {
  events: readonly EmailDeliveryEvent[];
  localStatus: EmailMessageStatus;
}): { conflict: boolean; status: EmailMessageStatus } => {
  const seenEventIds = new Set<string>();
  const evidence = new Set<EmailMessageStatus>([localStatus]);
  let status = localStatus;

  for (const event of events) {
    assertValidTimestamp(event.occurredAt);
    if (seenEventIds.has(event.providerEventId)) {
      continue;
    }
    seenEventIds.add(event.providerEventId);
    const eventStatus = mapResendEventType(event.type);
    if (!eventStatus) {
      continue;
    }
    evidence.add(eventStatus);
    if (STATUS_PRECEDENCE[eventStatus] > STATUS_PRECEDENCE[status]) {
      status = eventStatus;
    }
  }

  const terminalEvidenceCount = [...evidence].filter((value) =>
    CONFLICT_STATUSES.has(value)
  ).length;
  return { conflict: terminalEvidenceCount > 1, status };
};
