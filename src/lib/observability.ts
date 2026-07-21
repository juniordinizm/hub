const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_ATTRIBUTE_KEY =
  /(authorization|cookie|email|name|password|payload|secret|signature|signedurl|token|url)$/i;

export const CORRELATION_ID_HEADER = "x-correlation-id";

export type OperationalOutcome = "failure" | "success";

export interface OperationalEvent {
  aggregateId?: string;
  correlationId: string;
  durationMs?: number;
  errorCode?: string;
  httpStatus?: number;
  operation: string;
  outcome: OperationalOutcome;
  provider?: "abacatepay" | "database" | "jmvstream" | "r2" | "resend";
}

type OperationalAttributeValue = number | string | undefined;

export const createCorrelationId = (incomingId: string | null): string =>
  incomingId && CORRELATION_ID_PATTERN.test(incomingId)
    ? incomingId
    : crypto.randomUUID();

export const sanitizeOperationalAttributes = (
  attributes: Record<string, unknown>
): Record<string, OperationalAttributeValue> => {
  const sanitized: Record<string, OperationalAttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_ATTRIBUTE_KEY.test(key)) {
      continue;
    }

    if (typeof value === "number" || typeof value === "string") {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export const logOperationalEvent = (
  event: OperationalEvent,
  write: (record: string) => void = (record) => console.info(record)
): void => {
  write(
    JSON.stringify({
      ...sanitizeOperationalAttributes({ ...event }),
      event: "operational",
      timestamp: new Date().toISOString(),
    })
  );
};
