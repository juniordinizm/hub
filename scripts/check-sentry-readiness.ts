import {
  fetchSentryReadinessEvidence,
  verifySentryReadinessEvidence,
} from "../src/tooling/sentry-readiness-check";

const MAXIMUM_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 5000;

const argument = (name: string): string | undefined =>
  process.argv
    .slice(2)
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const required = (value: string | undefined, name: string): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
};

const delay = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

const run = async (): Promise<void> => {
  const authToken = required(
    process.env.SENTRY_READINESS_AUTH_TOKEN,
    "SENTRY_READINESS_AUTH_TOKEN"
  );
  const organization = required(process.env.SENTRY_ORG, "SENTRY_ORG");
  const project = required(process.env.SENTRY_PROJECT, "SENTRY_PROJECT");
  const projectId = required(
    process.env.SENTRY_PROJECT_ID,
    "SENTRY_PROJECT_ID"
  );
  const alertName = required(
    process.env.SENTRY_READINESS_ALERT_NAME,
    "SENTRY_READINESS_ALERT_NAME"
  );
  const eventId = required(argument("--event-id"), "--event-id");
  const environment = required(argument("--environment"), "--environment");
  if (environment !== "production" && environment !== "staging") {
    throw new Error("--environment must be production or staging.");
  }
  const release = required(argument("--release"), "--release");
  let lastErrors = ["Sentry evidence was not available before timeout"];

  for (let attempt = 1; attempt <= MAXIMUM_ATTEMPTS; attempt += 1) {
    try {
      const inventory = await fetchSentryReadinessEvidence({
        authToken,
        eventId,
        organization,
        project,
      });
      lastErrors = verifySentryReadinessEvidence({
        ...inventory,
        expected: {
          alertName,
          environment,
          eventId,
          projectId,
          release,
        },
      });
      if (lastErrors.length === 0) {
        process.stdout.write(
          `${JSON.stringify({
            alertTriggered: true,
            environment,
            eventId,
            match: true,
            release,
            sourceMapped: true,
          })}\n`
        );
        return;
      }
    } catch (error) {
      lastErrors = [
        error instanceof Error ? error.message : "Sentry readiness read failed",
      ];
    }

    if (attempt < MAXIMUM_ATTEMPTS) {
      await delay();
    }
  }

  throw new Error(`Sentry readiness failed: ${lastErrors.join(", ")}.`);
};

await run();
