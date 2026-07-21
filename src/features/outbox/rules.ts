export const OUTBOX_TOPICS = {
  accessExpiryWarning: "email.access-expiry-warning",
  accessReleased: "email.access-released",
  certificateIssued: "email.certificate-issued",
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type OutboxPayload =
  | { certificateId: string }
  | { courseId: string; userId: string }
  | { enrollmentId: string; warningKind: "1d" | "7d" };

export interface OutboxMessageInput {
  aggregateId: string;
  aggregateType: "certificate" | "enrollment" | "order";
  idempotencyKey: string;
  payload: OutboxPayload;
  payloadVersion: 1;
  topic: OutboxTopic;
}

const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_JITTER_RATIO = 0.125;

const unsupportedPayloadVersion = (): Error =>
  new Error("Versao de payload nao suportada.");

export const createCertificateIssuedMessage = ({
  certificateId,
}: {
  certificateId: string;
}): OutboxMessageInput => ({
  aggregateId: certificateId,
  aggregateType: "certificate",
  idempotencyKey: `${OUTBOX_TOPICS.certificateIssued}/${certificateId}/v1`,
  payload: { certificateId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.certificateIssued,
});

export const createPaidAccessReleasedMessage = ({
  courseId,
  orderId,
  userId,
}: {
  courseId: string;
  orderId: string;
  userId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.accessReleased}/${orderId}/v1`,
  payload: { courseId, userId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.accessReleased,
});

export const createEnrollmentExpiryWarningMessage = ({
  enrollmentId,
  warningKind,
}: {
  enrollmentId: string;
  warningKind: "1d" | "7d";
}): OutboxMessageInput => ({
  aggregateId: enrollmentId,
  aggregateType: "enrollment",
  idempotencyKey: `${OUTBOX_TOPICS.accessExpiryWarning}/${enrollmentId}/${warningKind}/v1`,
  payload: { enrollmentId, warningKind },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.accessExpiryWarning,
});

export const parseOutboxPayload = ({
  payload,
  payloadVersion,
  topic,
}: {
  payload: unknown;
  payloadVersion: number;
  topic: string;
}): OutboxPayload => {
  if (payloadVersion !== 1 || !(payload && typeof payload === "object")) {
    throw unsupportedPayloadVersion();
  }

  if (topic === OUTBOX_TOPICS.certificateIssued) {
    const certificateId = (payload as { certificateId?: unknown })
      .certificateId;
    if (typeof certificateId === "string" && certificateId) {
      return { certificateId };
    }
  }

  if (topic === OUTBOX_TOPICS.accessReleased) {
    const { courseId, userId } = payload as {
      courseId?: unknown;
      userId?: unknown;
    };
    if (
      typeof courseId === "string" &&
      courseId &&
      typeof userId === "string" &&
      userId
    ) {
      return { courseId, userId };
    }
  }

  if (topic === OUTBOX_TOPICS.accessExpiryWarning) {
    const { enrollmentId, warningKind } = payload as {
      enrollmentId?: unknown;
      warningKind?: unknown;
    };
    if (
      typeof enrollmentId === "string" &&
      enrollmentId &&
      (warningKind === "1d" || warningKind === "7d")
    ) {
      return { enrollmentId, warningKind };
    }
  }

  throw unsupportedPayloadVersion();
};

export const getRetryDelayMs = ({
  attempt,
  random = Math.random,
}: {
  attempt: number;
  random?: () => number;
}): number => {
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.round(
    exponentialDelay * RETRY_MAX_JITTER_RATIO * random()
  );
  return exponentialDelay + jitter;
};
