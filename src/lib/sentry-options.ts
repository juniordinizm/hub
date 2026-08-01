import type { ErrorEvent } from "@sentry/core";

const SENTRY_TRACE_SAMPLE_RATE = 0.1;

const stripQuery = (url: string | undefined): string | undefined => {
  if (!url) {
    return;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return;
  }
};

const sanitizeSentryEvent = (event: ErrorEvent): ErrorEvent => {
  const { request, user: _user, ...safeEvent } = event;
  const url = stripQuery(request?.url);

  return {
    ...safeEvent,
    ...(request ? { request: url ? { url } : {} } : {}),
  };
};

export const getSentryOptions = (
  dsn: string | undefined,
  environment?: string
) => ({
  beforeSend: sanitizeSentryEvent,
  dsn,
  enabled: Boolean(dsn),
  ...(environment ? { environment } : {}),
  sendDefaultPii: false,
  tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
});
