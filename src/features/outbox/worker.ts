import { getRetryDelayMs, type OutboxPayload, type OutboxTopic } from "./rules";

export const OUTBOX_MAX_ATTEMPTS = 5;

export interface ClaimedOutboxMessage {
  aggregateId: string;
  aggregateType: string;
  attempts: number;
  id: string;
  idempotencyKey: string;
  payload: OutboxPayload;
  payloadVersion: number;
  topic: OutboxTopic;
}

export class OutboxDeliveryError extends Error {
  readonly code: string;
  readonly deferred: boolean;
  readonly retryable: boolean;

  constructor(
    code: string,
    { deferred = false, retryable }: { deferred?: boolean; retryable: boolean }
  ) {
    super(code);
    this.code = code;
    this.deferred = deferred;
    this.retryable = retryable;
  }
}

export type OutboxSupersededReason =
  | "expiry_generation_changed"
  | "expiry_inactive"
  | "expiry_payload_v1"
  | "expiry_window_elapsed";

export class OutboxSupersededError extends Error {
  readonly code: OutboxSupersededReason;

  constructor(code: OutboxSupersededReason) {
    super(code);
    this.code = code;
  }
}

const getDeliveryError = (error: unknown): OutboxDeliveryError =>
  error instanceof OutboxDeliveryError
    ? error
    : new OutboxDeliveryError("delivery_failed", { retryable: true });

export type OutboxProcessingOutcome =
  | "dead_letter"
  | "deferred"
  | "delivered"
  | "lease_lost"
  | "retrying"
  | "superseded";

interface OutboxFailureTransitions {
  markDeadLetter: (input: {
    errorCode: string;
    id: string;
  }) => Promise<boolean>;
  markDeferred: (input: { errorCode: string; id: string }) => Promise<boolean>;
  markRetry: (input: {
    errorCode: string;
    id: string;
    retryDelayMs: number;
  }) => Promise<boolean>;
  markSuperseded: (input: {
    errorCode: OutboxSupersededReason;
    id: string;
  }) => Promise<boolean>;
}

const processOutboxFailure = async ({
  error,
  markDeadLetter,
  markDeferred,
  markRetry,
  markSuperseded,
  message,
  random,
}: OutboxFailureTransitions & {
  error: unknown;
  message: ClaimedOutboxMessage;
  random?: () => number;
}): Promise<OutboxProcessingOutcome> => {
  if (error instanceof OutboxSupersededError) {
    const transitioned = await markSuperseded({
      errorCode: error.code,
      id: message.id,
    });
    return transitioned ? "superseded" : "lease_lost";
  }
  const deliveryError = getDeliveryError(error);
  if (deliveryError.deferred) {
    const transitioned = await markDeferred({
      errorCode: deliveryError.code,
      id: message.id,
    });
    return transitioned ? "deferred" : "lease_lost";
  }
  if (!deliveryError.retryable || message.attempts >= OUTBOX_MAX_ATTEMPTS) {
    const transitioned = await markDeadLetter({
      errorCode: deliveryError.code,
      id: message.id,
    });
    return transitioned ? "dead_letter" : "lease_lost";
  }
  const transitioned = await markRetry({
    errorCode: deliveryError.code,
    id: message.id,
    retryDelayMs: getRetryDelayMs({
      attempt: message.attempts,
      ...(random ? { random } : {}),
    }),
  });
  return transitioned ? "retrying" : "lease_lost";
};

export const processClaimedOutboxMessage = async ({
  deliver,
  markDeadLetter,
  markDeferred,
  markDelivered,
  markRetry,
  markSuperseded,
  message,
  random,
}: {
  deliver: (message: ClaimedOutboxMessage) => Promise<void>;
  markDeadLetter: (input: {
    errorCode: string;
    id: string;
  }) => Promise<boolean>;
  markDeferred: (input: { errorCode: string; id: string }) => Promise<boolean>;
  markDelivered: (id: string) => Promise<boolean>;
  markRetry: (input: {
    errorCode: string;
    id: string;
    retryDelayMs: number;
  }) => Promise<boolean>;
  markSuperseded: (input: {
    errorCode: OutboxSupersededReason;
    id: string;
  }) => Promise<boolean>;
  message: ClaimedOutboxMessage;
  random?: () => number;
}): Promise<OutboxProcessingOutcome> => {
  try {
    await deliver(message);
    return (await markDelivered(message.id)) ? "delivered" : "lease_lost";
  } catch (error) {
    return await processOutboxFailure({
      error,
      markDeadLetter,
      markDeferred,
      markRetry,
      markSuperseded,
      message,
      ...(random ? { random } : {}),
    });
  }
};
