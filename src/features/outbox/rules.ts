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

type OutboxPayloadV1 =
  | { certificateId: string }
  | { courseId: string; userId: string }
  | { enrollmentId: string; warningKind: "1d" | "7d" }
  | { interestId: string }
  | { orderId: string }
  | { orderId: string; userId: string }
  | { requestId: string };

export interface ExpiryWarningPayloadV2 {
  enrollmentId: string;
  expectedExpiresAt: string;
  warningKind: "1d" | "7d";
}

export type OutboxPayload = OutboxPayloadV1 | ExpiryWarningPayloadV2;

interface OutboxMessageBase {
  aggregateId: string;
  aggregateType:
    | "certificate"
    | "course_interest"
    | "enrollment"
    | "order"
    | "support_request";
  idempotencyKey: string;
}

interface OutboxMessageInputV1 extends OutboxMessageBase {
  payload: OutboxPayloadV1;
  payloadVersion: 1;
  topic: OutboxTopic;
}

interface ExpiryWarningMessageInputV2 extends OutboxMessageBase {
  aggregateType: "enrollment";
  payload: ExpiryWarningPayloadV2;
  payloadVersion: 2;
  topic: typeof OUTBOX_TOPICS.accessExpiryWarning;
}

export type OutboxMessageInput =
  | ExpiryWarningMessageInputV2
  | OutboxMessageInputV1;

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
  expectedExpiresAt,
  warningKind,
}: {
  enrollmentId: string;
  expectedExpiresAt: Date;
  warningKind: "1d" | "7d";
}): OutboxMessageInput => {
  if (Number.isNaN(expectedExpiresAt.getTime())) {
    throw new Error("Validade esperada invalida.");
  }
  const expectedExpiresAtIso = expectedExpiresAt.toISOString();
  return {
    aggregateId: enrollmentId,
    aggregateType: "enrollment",
    idempotencyKey: `${OUTBOX_TOPICS.accessExpiryWarning}/${enrollmentId}/${warningKind}/${expectedExpiresAt.getTime()}/v2`,
    payload: {
      enrollmentId,
      expectedExpiresAt: expectedExpiresAtIso,
      warningKind,
    },
    payloadVersion: 2,
    topic: OUTBOX_TOPICS.accessExpiryWarning,
  };
};

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
  idempotencyKey,
  payload,
  payloadVersion,
  topic,
}: {
  idempotencyKey?: string;
  payload: unknown;
  payloadVersion: number;
  topic: string;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates a closed discriminated union without accepting extra fields.
}): OutboxPayload => {
  if (!(payload && typeof payload === "object")) {
    throw unsupportedPayloadVersion();
  }

  if (topic === OUTBOX_TOPICS.accessExpiryWarning) {
    const { enrollmentId, expectedExpiresAt, warningKind } = payload as {
      enrollmentId?: unknown;
      expectedExpiresAt?: unknown;
      warningKind?: unknown;
    };
    const validIdentity =
      typeof enrollmentId === "string" &&
      Boolean(enrollmentId) &&
      (warningKind === "1d" || warningKind === "7d");
    if (
      payloadVersion === 1 &&
      Object.keys(payload).length === 2 &&
      validIdentity
    ) {
      return { enrollmentId, warningKind } as {
        enrollmentId: string;
        warningKind: "1d" | "7d";
      };
    }
    if (
      payloadVersion === 2 &&
      Object.keys(payload).length === 3 &&
      validIdentity &&
      typeof expectedExpiresAt === "string" &&
      idempotencyKey
    ) {
      const parsedDate = new Date(expectedExpiresAt);
      if (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString() === expectedExpiresAt &&
        idempotencyKey ===
          `${OUTBOX_TOPICS.accessExpiryWarning}/${enrollmentId}/${warningKind}/${parsedDate.getTime()}/v2`
      ) {
        return {
          enrollmentId,
          expectedExpiresAt,
          warningKind,
        } as ExpiryWarningPayloadV2;
      }
    }
    throw unsupportedPayloadVersion();
  }

  if (payloadVersion !== 1) {
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

const MILLISECONDS_PER_DAY = 86_400_000;

export type ExpiryWarningGenerationState =
  | "changed"
  | "current"
  | "expired"
  | "inactive"
  | "wrong_window";

export const classifyExpiryWarningGeneration = ({
  currentExpiresAt,
  expectedExpiresAt,
  now,
  status,
  warningKind,
}: {
  currentExpiresAt: Date;
  expectedExpiresAt: string;
  now: Date;
  status: "active" | "expired" | "revoked";
  warningKind: "1d" | "7d";
}): ExpiryWarningGenerationState => {
  if (status !== "active") {
    return "inactive";
  }
  if (currentExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  if (currentExpiresAt.toISOString() !== expectedExpiresAt) {
    return "changed";
  }
  const daysRemaining = Math.ceil(
    (currentExpiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY
  );
  const isCurrentWindow =
    warningKind === "7d"
      ? daysRemaining >= 2 && daysRemaining <= 7
      : daysRemaining >= 0 && daysRemaining <= 1;
  return isCurrentWindow ? "current" : "wrong_window";
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
