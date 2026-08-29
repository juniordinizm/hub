interface ExpectedSentryReadinessEvidence {
  alertName: string;
  environment: "production" | "staging";
  eventId: string;
  projectId: string;
  release: string;
}

interface VerifySentryReadinessEvidenceInput {
  detectors: unknown;
  event: unknown;
  expected: ExpectedSentryReadinessEvidence;
  workflows: unknown;
}

interface FetchSentryReadinessEvidenceInput {
  apiBaseUrl?: string;
  authToken: string;
  eventId: string;
  fetchImpl?: typeof fetch;
  organization: string;
  project: string;
}

export interface SentryReadinessInventory {
  detectors: unknown;
  event: unknown;
  workflows: unknown;
}

const EVENT_ID = /^[0-9a-f]{32}$/i;
const FULL_GIT_SHA = /^[0-9a-f]{40}$/i;
const SENSITIVE_KEY =
  /^(?:authorization|cookie|cookies|email|ip_address|ipaddress|password|secret|signature|token|payload|signed_url|user|username)$/iu;
const DERIVED_USER_FIELD = "geo";
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/iu;
const LOCATION_QUERY = /(?:https?:\/\/|\/)[^\s?#]+[?#]/iu;
const SOURCE_FRAME = /(?:^|\/)src\/lib\/sentry-readiness\.ts$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizedString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const eventTags = (event: Record<string, unknown>): Map<string, string> => {
  const tags = new Map<string, string>();
  if (!Array.isArray(event.tags)) {
    return tags;
  }
  for (const tag of event.tags) {
    if (Array.isArray(tag)) {
      const key = normalizedString(tag[0]);
      const value = normalizedString(tag[1]);
      if (key && value) {
        tags.set(key, value);
      }
      continue;
    }
    if (isRecord(tag)) {
      const key = normalizedString(tag.key);
      const value = normalizedString(tag.value);
      if (key && value) {
        tags.set(key, value);
      }
    }
  }
  return tags;
};

const eventRelease = (
  event: Record<string, unknown>,
  tags: Map<string, string>
): string | undefined => {
  if (typeof event.release === "string") {
    return event.release;
  }
  if (isRecord(event.release)) {
    return normalizedString(event.release.version);
  }
  return tags.get("release");
};

const containsSensitiveTelemetry = (
  value: unknown,
  insideStackFrame = false
): boolean => {
  if (typeof value === "string") {
    return (
      EMAIL_VALUE.test(value) ||
      BEARER_VALUE.test(value) ||
      LOCATION_QUERY.test(value)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsSensitiveTelemetry(item, insideStackFrame)
    );
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([key, item]) => {
    if (insideStackFrame && key === "context") {
      return false;
    }

    if (key === "user" && isRecord(item)) {
      return Object.entries(item).some(
        ([userKey, userValue]) =>
          userValue !== null &&
          userValue !== undefined &&
          (userKey !== DERIVED_USER_FIELD ||
            containsSensitiveTelemetry(userValue))
      );
    }

    return (
      (SENSITIVE_KEY.test(key) && item !== null && item !== undefined) ||
      containsSensitiveTelemetry(item, insideStackFrame || key === "frames")
    );
  });
};

const hasSourceMappedReadinessFrame = (value: unknown): boolean => {
  if (typeof value === "string") {
    return SOURCE_FRAME.test(value.replaceAll("\\", "/"));
  }
  if (Array.isArray(value)) {
    return value.some(hasSourceMappedReadinessFrame);
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    Object.entries(value).some(
      ([key, item]) =>
        (key === "filename" || key === "absPath") &&
        typeof item === "string" &&
        SOURCE_FRAME.test(item.replaceAll("\\", "/"))
    ) || Object.values(value).some(hasSourceMappedReadinessFrame)
  );
};

const parsedTimestamp = (value: unknown): number | undefined => {
  const timestamp = normalizedString(value);
  if (!timestamp) {
    return;
  }
  const milliseconds = Date.parse(timestamp);
  return Number.isNaN(milliseconds) ? undefined : milliseconds;
};

const alertReachedEvent = ({
  detectors,
  event,
  expected,
  workflows,
}: VerifySentryReadinessEvidenceInput): boolean => {
  if (
    !(Array.isArray(workflows) && Array.isArray(detectors) && isRecord(event))
  ) {
    return false;
  }
  const eventTimestamp =
    parsedTimestamp(event.dateCreated) ?? parsedTimestamp(event.dateReceived);
  if (eventTimestamp === undefined) {
    return false;
  }

  const workflow = workflows.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.enabled === true &&
      candidate.name === expected.alertName &&
      candidate.environment === expected.environment
  );
  if (!isRecord(workflow)) {
    return false;
  }
  const workflowId = normalizedString(workflow.id);
  const lastTriggered = parsedTimestamp(workflow.lastTriggered);
  if (
    !workflowId ||
    lastTriggered === undefined ||
    lastTriggered < eventTimestamp
  ) {
    return false;
  }

  return detectors.some(
    (detector) =>
      isRecord(detector) &&
      detector.enabled === true &&
      String(detector.projectId) === expected.projectId &&
      Array.isArray(detector.workflowIds) &&
      detector.workflowIds.includes(workflowId)
  );
};

export const verifySentryReadinessEvidence = ({
  detectors,
  event,
  expected,
  workflows,
}: VerifySentryReadinessEvidenceInput): string[] => {
  const errors: string[] = [];
  if (
    !(EVENT_ID.test(expected.eventId) && FULL_GIT_SHA.test(expected.release))
  ) {
    return ["expected Sentry event ID or release is invalid"];
  }
  if (!isRecord(event)) {
    return ["Sentry event response is incomplete"];
  }

  const tags = eventTags(event);
  if (
    normalizedString(event.eventID ?? event.eventId ?? event.id) !==
    expected.eventId
  ) {
    errors.push("event ID does not match the emitted event");
  }
  if (eventRelease(event, tags) !== expected.release) {
    errors.push("event release does not match the deployment SHA");
  }
  if (tags.get("environment") !== expected.environment) {
    errors.push("event environment does not match the deployment");
  }
  if (tags.get("readiness_probe") !== "sentry") {
    errors.push("readiness_probe tag is absent");
  }
  if (containsSensitiveTelemetry(event)) {
    errors.push("event contains a sensitive attribute or value");
  }
  if (!hasSourceMappedReadinessFrame(event.entries)) {
    errors.push(
      "exception frame does not resolve to src/lib/sentry-readiness.ts"
    );
  }
  if (!alertReachedEvent({ detectors, event, expected, workflows })) {
    errors.push("expected alert workflow did not reach the event");
  }
  return errors;
};

const readJson = async ({
  authToken,
  fetchImpl,
  url,
}: {
  authToken: string;
  fetchImpl: typeof fetch;
  url: string;
}): Promise<unknown> => {
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${authToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Sentry read failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as unknown;
};

export const fetchSentryReadinessEvidence = async ({
  apiBaseUrl = "https://sentry.io/api/0",
  authToken,
  eventId,
  fetchImpl = fetch,
  organization,
  project,
}: FetchSentryReadinessEvidenceInput): Promise<SentryReadinessInventory> => {
  if (!(authToken.trim() && EVENT_ID.test(eventId))) {
    throw new Error("Sentry readiness checker input is invalid.");
  }
  const encodedOrganization = encodeURIComponent(organization);
  const encodedProject = encodeURIComponent(project);
  const headers = { authToken, fetchImpl };
  const [event, workflows, detectors] = await Promise.all([
    readJson({
      ...headers,
      url: `${apiBaseUrl}/projects/${encodedOrganization}/${encodedProject}/events/${eventId}/`,
    }),
    readJson({
      ...headers,
      url: `${apiBaseUrl}/organizations/${encodedOrganization}/workflows/`,
    }),
    readJson({
      ...headers,
      url: `${apiBaseUrl}/organizations/${encodedOrganization}/detectors/`,
    }),
  ]);
  return { detectors, event, workflows };
};
