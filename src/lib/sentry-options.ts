import type {
  Breadcrumb,
  ErrorEvent,
  SpanJSON,
  TransactionEvent,
} from "@sentry/core";
import { isFullSentryRelease } from "./sentry-deployment";

const SENTRY_TRACE_SAMPLE_RATE = 0.1;
const CERTIFICATE_CODE = /\bPRT-[0-9A-Z-]{6,}\b/giu;
const CERTIFICATE_REFERENCE =
  /\/certificados\/[^/?#\s]+((?:\/[^?#\s]*)?)(?:[?#]\S*)?/giu;
const LOCATION_VALUE = /^(?:[A-Z]+\s+)?(?:https?:\/\/|\/)\S+$/u;
const QUERY_OR_FRAGMENT = /[?#]/u;
const CERTIFICATE_CODE_PLACEHOLDER = "[certificate-code]";
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const LOCATION_WITH_QUERY = /(?:https?:\/\/|\/)[^\s?#]+[?#][^\s]*/giu;
const SENSITIVE_ATTRIBUTE_KEY =
  /authorization|cookie|email|password|secret|signature|token|payload|signed.?url|user.?name/iu;
const REDACTED_EMAIL = "[email]";
const REDACTED_TOKEN = "Bearer [token]";
const CIRCULAR_REFERENCE = "[circular]";

const normalizeTelemetryText = (value: string): string => {
  const withoutCertificateQuery = value.replace(
    CERTIFICATE_REFERENCE,
    (_reference, pathSuffix: string | undefined) =>
      `/certificados/${CERTIFICATE_CODE_PLACEHOLDER}${pathSuffix ?? ""}`
  );
  const withoutEmbeddedLocationQuery = withoutCertificateQuery.replace(
    LOCATION_WITH_QUERY,
    (location) => location.split(QUERY_OR_FRAGMENT, 1)[0] ?? location
  );
  const withoutLocationQuery = LOCATION_VALUE.test(withoutEmbeddedLocationQuery)
    ? (withoutEmbeddedLocationQuery.split(QUERY_OR_FRAGMENT, 1)[0] ??
      withoutEmbeddedLocationQuery)
    : withoutEmbeddedLocationQuery;

  return withoutLocationQuery
    .replace(CERTIFICATE_CODE, CERTIFICATE_CODE_PLACEHOLDER)
    .replace(EMAIL_ADDRESS, REDACTED_EMAIL)
    .replace(BEARER_TOKEN, REDACTED_TOKEN);
};

const sanitizeRequestUrl = (url: string | undefined): string | undefined => {
  if (!url) {
    return;
  }

  return normalizeTelemetryText(url);
};

const sanitizeTelemetryValue = (
  value: unknown,
  ancestors: WeakSet<object> = new WeakSet()
): unknown => {
  if (typeof value === "string") {
    return normalizeTelemetryText(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (ancestors.has(value)) {
    return CIRCULAR_REFERENCE;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeTelemetryValue(item, ancestors));
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_ATTRIBUTE_KEY.test(key))
        .map(([key, item]) => [key, sanitizeTelemetryValue(item, ancestors)])
    );
  } finally {
    ancestors.delete(value);
  }
};

const sanitizeSentryEvent = (event: ErrorEvent): ErrorEvent => {
  const { request, user: _user, ...safeEvent } = event;
  const url = sanitizeRequestUrl(request?.url);

  return {
    ...(sanitizeTelemetryValue(safeEvent) as ErrorEvent),
    ...(request ? { request: url ? { url } : {} } : {}),
  };
};

const sanitizeSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb =>
  sanitizeTelemetryValue(breadcrumb) as Breadcrumb;

const sanitizeSentryTransaction = (event: TransactionEvent): TransactionEvent =>
  sanitizeTelemetryValue(event) as TransactionEvent;

const sanitizeSpanData = (data: SpanJSON["data"]): SpanJSON["data"] => {
  const sanitizedData: SpanJSON["data"] = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      sanitizedData[key] = normalizeTelemetryText(value);
      continue;
    }
    if (Array.isArray(value)) {
      sanitizedData[key] = value.map((item) =>
        typeof item === "string" ? normalizeTelemetryText(item) : item
      ) as typeof value;
      continue;
    }
    sanitizedData[key] = value;
  }
  return sanitizedData;
};

const sanitizeSentrySpan = (span: SpanJSON): SpanJSON => {
  const sanitized = sanitizeTelemetryValue(span) as SpanJSON;
  return { ...sanitized, data: sanitizeSpanData(sanitized.data) };
};

export const getSentryOptions = (
  dsn: string | undefined,
  environment?: string,
  release?: string
) => {
  const protectedEnvironment =
    environment === "production" || environment === "staging";
  if (dsn && protectedEnvironment && !isFullSentryRelease(release)) {
    throw new Error("Sentry release must be the full deployment Git SHA.");
  }

  return {
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    beforeSendSpan: sanitizeSentrySpan,
    beforeSendTransaction: sanitizeSentryTransaction,
    dsn,
    enabled: Boolean(dsn),
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
    sendDefaultPii: false,
    tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
  };
};
