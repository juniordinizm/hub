export const OUTBOX_TOPICS = {
  accountActivation: "auth.account-activation",
  accessExpiryWarning: "email.access-expiry-warning",
  accessReleased: "email.access-released",
  certificateIssued: "email.certificate-issued",
  certificateRender: "certificate.render",
  checkoutCancellation: "payments.checkout-cancel",
  courseSalesOpened: "email.course-sales-opened",
  supportRequest: "email.support-request",
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type OutboxPayload =
  | { certificateId: string }
  | { courseId: string; userId: string }
  | { enrollmentId: string; warningKind: "1d" | "7d" }
  | { interestId: string }
  | { orderId: string }
  | { orderId: string; userId: string }
  | { requestId: string };

export interface OutboxMessageInput {
  aggregateId: string;
  aggregateType:
    | "certificate"
    | "course_interest"
    | "enrollment"
    | "order"
    | "support_request";
  idempotencyKey: string;
  payload: OutboxPayload;
  payloadVersion: 1;
  topic: OutboxTopic;
}

const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_JITTER_RATIO = 0.125;

const unsupportedPayloadVersion = (): Error =>
  new Error("Versao de payload nao suportada.");

const parseAccountActivationPayload = (
  payload: object
): { orderId: string; userId: string } | null => {
  const { orderId, userId } = payload as {
    orderId?: unknown;
    userId?: unknown;
  };
  if (
    Object.keys(payload).length !== 2 ||
    typeof orderId !== "string" ||
    !orderId ||
    typeof userId !== "string" ||
    !userId
  ) {
    return null;
  }
  return { orderId, userId };
};

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

export const createAccountActivationMessage = ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.accountActivation}/${orderId}/v1`,
  payload: { orderId, userId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.accountActivation,
});

export const createCertificateRenderMessage = ({
  certificateId,
}: {
  certificateId: string;
}): OutboxMessageInput => ({
  aggregateId: certificateId,
  aggregateType: "certificate",
  idempotencyKey: `${OUTBOX_TOPICS.certificateRender}/${certificateId}/v1`,
  payload: { certificateId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.certificateRender,
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

export const createCourseSalesOpenedMessage = ({
  interestId,
}: {
  interestId: string;
}): OutboxMessageInput => ({
  aggregateId: interestId,
  aggregateType: "course_interest",
  idempotencyKey: `${OUTBOX_TOPICS.courseSalesOpened}/${interestId}/v1`,
  payload: { interestId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.courseSalesOpened,
});

export const createCheckoutCancellationMessage = ({
  orderId,
}: {
  orderId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.checkoutCancellation}/${orderId}/v1`,
  payload: { orderId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.checkoutCancellation,
});

export const createSupportRequestMessage = ({
  requestId,
}: {
  requestId: string;
}): OutboxMessageInput => ({
  aggregateId: requestId,
  aggregateType: "support_request",
  idempotencyKey: `${OUTBOX_TOPICS.supportRequest}/${requestId}/v1`,
  payload: { requestId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.supportRequest,
});

export const parseOutboxPayload = ({
  payload,
  payloadVersion,
  topic,
}: {
  payload: unknown;
  payloadVersion: number;
  topic: string;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates a closed discriminated union without accepting extra fields.
}): OutboxPayload => {
  if (payloadVersion !== 1 || !(payload && typeof payload === "object")) {
    throw unsupportedPayloadVersion();
  }

  if (
    topic === OUTBOX_TOPICS.certificateIssued ||
    topic === OUTBOX_TOPICS.certificateRender
  ) {
    const certificateId = (payload as { certificateId?: unknown })
      .certificateId;
    if (typeof certificateId === "string" && certificateId) {
      return { certificateId };
    }
  }

  if (topic === OUTBOX_TOPICS.accountActivation) {
    const activationPayload = parseAccountActivationPayload(payload);
    if (activationPayload) {
      return activationPayload;
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

  if (topic === OUTBOX_TOPICS.courseSalesOpened) {
    const { interestId } = payload as { interestId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof interestId === "string" &&
      interestId
    ) {
      return { interestId };
    }
  }

  if (topic === OUTBOX_TOPICS.checkoutCancellation) {
    const { orderId } = payload as { orderId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof orderId === "string" &&
      orderId
    ) {
      return { orderId };
    }
  }

  if (topic === OUTBOX_TOPICS.supportRequest) {
    const { requestId } = payload as { requestId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof requestId === "string" &&
      requestId
    ) {
      return { requestId };
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
