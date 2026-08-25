import { captureException, flush } from "@sentry/nextjs";
import { isFullSentryRelease } from "./sentry-deployment";

type ProtectedSentryEnvironment = "production" | "staging";

interface EmitSentryReadinessEventInput {
  captureException?: (
    exception: unknown,
    context: { tags: Record<string, string> }
  ) => string;
  correlationId?: string;
  environment: ProtectedSentryEnvironment;
  flush?: (timeout: number) => Promise<boolean>;
  release: string;
}

interface SentryReadinessEvidence {
  correlationId: string;
  eventId: string;
}

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

export class SentryReadinessProbeError extends Error {
  constructor() {
    super("Synthetic Sentry readiness probe");
    this.name = "SentryReadinessProbeError";
  }
}

export const emitSentryReadinessEvent = async ({
  captureException: capture = captureException,
  correlationId = crypto.randomUUID(),
  environment,
  flush: flushEvents = flush,
  release,
}: EmitSentryReadinessEventInput): Promise<SentryReadinessEvidence> => {
  if (!isFullSentryRelease(release)) {
    throw new Error("Sentry readiness release must be a full Git SHA.");
  }

  const eventId = capture(new SentryReadinessProbeError(), {
    tags: {
      environment,
      readiness_probe: "sentry",
      release,
    },
  });
  const flushed = await flushEvents(SENTRY_FLUSH_TIMEOUT_MS);
  if (!flushed) {
    throw new Error("Sentry readiness event flush timed out.");
  }

  return { correlationId, eventId };
};
