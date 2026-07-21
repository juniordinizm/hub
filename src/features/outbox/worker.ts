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
  readonly retryable: boolean;

  constructor(code: string, { retryable }: { retryable: boolean }) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

const getDeliveryError = (error: unknown): OutboxDeliveryError =>
  error instanceof OutboxDeliveryError
    ? error
    : new OutboxDeliveryError("delivery_failed", { retryable: true });

export const processClaimedOutboxMessage = async ({
  deliver,
  markDeadLetter,
  markDelivered,
  markRetry,
  message,
  random,
}: {
  deliver: (message: ClaimedOutboxMessage) => Promise<void>;
  markDeadLetter: (input: { errorCode: string; id: string }) => Promise<void>;
  markDelivered: (id: string) => Promise<void>;
  markRetry: (input: {
    errorCode: string;
    id: string;
    retryDelayMs: number;
  }) => Promise<void>;
  message: ClaimedOutboxMessage;
  random?: () => number;
}): Promise<"dead_letter" | "delivered" | "retrying"> => {
  try {
    await deliver(message);
    await markDelivered(message.id);
    return "delivered";
  } catch (error) {
    const deliveryError = getDeliveryError(error);
    if (!deliveryError.retryable || message.attempts >= OUTBOX_MAX_ATTEMPTS) {
      await markDeadLetter({
        errorCode: deliveryError.code,
        id: message.id,
      });
      return "dead_letter";
    }

    await markRetry({
      errorCode: deliveryError.code,
      id: message.id,
      retryDelayMs: getRetryDelayMs({
        attempt: message.attempts,
        ...(random ? { random } : {}),
      }),
    });
    return "retrying";
  }
};
