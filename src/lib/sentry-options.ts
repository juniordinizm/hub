import type {
  Breadcrumb,
  ErrorEvent,
  SpanJSON,
  TransactionEvent,
} from "@sentry/core";

const SENTRY_TRACE_SAMPLE_RATE = 0.1;
const CERTIFICATE_CODE = /\bPRT-[0-9A-Z-]{6,}\b/giu;
const CERTIFICATE_REFERENCE =
  /\/certificados\/[^/?#\s]+((?:\/[^?#\s]*)?)(?:[?#]\S*)?/giu;
const LOCATION_VALUE = /^(?:[A-Z]+\s+)?(?:https?:\/\/|\/)\S+$/u;
const QUERY_OR_FRAGMENT = /[?#]/u;
const CERTIFICATE_CODE_PLACEHOLDER = "[certificate-code]";

const normalizeCertificateTelemetryText = (value: string): string => {
  const withoutCertificateQuery = value.replace(
    CERTIFICATE_REFERENCE,
    (_reference, pathSuffix: string | undefined) =>
      `/certificados/${CERTIFICATE_CODE_PLACEHOLDER}${pathSuffix ?? ""}`
  );
  const withoutLocationQuery = LOCATION_VALUE.test(withoutCertificateQuery)
    ? (withoutCertificateQuery.split(QUERY_OR_FRAGMENT, 1)[0] ??
      withoutCertificateQuery)
    : withoutCertificateQuery;

  return withoutLocationQuery.replace(
    CERTIFICATE_CODE,
    CERTIFICATE_CODE_PLACEHOLDER
  );
};

const sanitizeRequestUrl = (url: string | undefined): string | undefined => {
  if (!url) {
    return;
  }

  return normalizeCertificateTelemetryText(url);
};

const sanitizeSentryEvent = (event: ErrorEvent): ErrorEvent => {
  const { request, user: _user, ...safeEvent } = event;
  const url = sanitizeRequestUrl(request?.url);

  return {
    ...safeEvent,
    ...(request ? { request: url ? { url } : {} } : {}),
  };
};

const sanitizeSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => ({
  ...breadcrumb,
  ...(breadcrumb.data
    ? {
        data: Object.fromEntries(
          Object.entries(breadcrumb.data).map(([key, value]) => [
            key,
            typeof value === "string"
              ? normalizeCertificateTelemetryText(value)
              : value,
          ])
        ),
      }
    : {}),
  ...(breadcrumb.message
    ? { message: normalizeCertificateTelemetryText(breadcrumb.message) }
    : {}),
});

const sanitizeSentryTransaction = (
  event: TransactionEvent
): TransactionEvent => ({
  ...event,
  ...(event.transaction
    ? { transaction: normalizeCertificateTelemetryText(event.transaction) }
    : {}),
});

const sanitizeSpanData = (data: SpanJSON["data"]): SpanJSON["data"] => {
  const sanitizedData: SpanJSON["data"] = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      sanitizedData[key] = normalizeCertificateTelemetryText(value);
      continue;
    }
    if (Array.isArray(value)) {
      sanitizedData[key] = value.map((item) =>
        typeof item === "string"
          ? normalizeCertificateTelemetryText(item)
          : item
      ) as typeof value;
      continue;
    }
    sanitizedData[key] = value;
  }
  return sanitizedData;
};

const sanitizeSentrySpan = (span: SpanJSON): SpanJSON => ({
  ...span,
  data: sanitizeSpanData(span.data),
  ...(span.description
    ? { description: normalizeCertificateTelemetryText(span.description) }
    : {}),
});

export const getSentryOptions = (
  dsn: string | undefined,
  environment?: string
) => ({
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  beforeSendSpan: sanitizeSentrySpan,
  beforeSendTransaction: sanitizeSentryTransaction,
  dsn,
  enabled: Boolean(dsn),
  ...(environment ? { environment } : {}),
  sendDefaultPii: false,
  tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
});
