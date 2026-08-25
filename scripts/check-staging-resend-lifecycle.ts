import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { assertStagingTarget } from "../src/db/staging-target";
import {
  type StagingResendLifecycleEvidence,
  verifyStagingResendLifecycle,
} from "../src/tooling/staging-resend-lifecycle";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const ATTEMPTS = 36;
const POLL_INTERVAL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const EXPECTED_ORIGIN = "https://preview.neurocapacitar.com.br";
const EXECUTION_CONFIRMATION = "SEND_CONTROLLED_STAGING_PASSWORD_RESET";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Staging Resend lifecycle.`);
  }
  return value;
};

if (process.argv.slice(2).length !== 1 || process.argv[2] !== "--execute") {
  throw new Error("Use only --execute for the Staging Resend lifecycle.");
}
if (process.env.GITHUB_ACTIONS !== "true") {
  throw new Error("Staging Resend lifecycle runs only in GitHub Actions.");
}
if (required("RESEND_LIFECYCLE_CONFIRMATION") !== EXECUTION_CONFIRMATION) {
  throw new Error("Staging Resend lifecycle confirmation is invalid.");
}

const origin = required("STAGING_ORIGIN");
if (origin !== EXPECTED_ORIGIN) {
  throw new Error("Staging Resend lifecycle origin is invalid.");
}
const cronSecret = required("CRON_SECRET");
const readinessSecret = required("RESEND_READINESS_SECRET");
const databaseUrl = required("DATABASE_URL_DIRECT");
assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl,
  expectedBranchId: process.env.STAGING_NEON_BRANCH_ID,
  expectedHost: process.env.STAGING_DATABASE_HOST,
});

const pool = new Pool({
  application_name: "hub-staging-resend-lifecycle",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 1,
});

const readEvidence = async (
  correlationId: string
): Promise<StagingResendLifecycleEvidence | null> => {
  const messageResult = await pool.query<{
    correlation_id: string;
    delivery_event_conflict: boolean;
    id: string;
    last_error_code: string | null;
    provider_message_id: string | null;
    status: string;
  }>(
    `
      select
        id,
        correlation_id,
        provider_message_id,
        status,
        delivery_event_conflict,
        last_error_code
      from email_messages
      where correlation_id = $1
      limit 1
    `,
    [correlationId]
  );
  const message = messageResult.rows[0];
  if (!message) {
    return null;
  }
  const eventResult = await pool.query<{
    event_type: string;
    status: string;
  }>(
    `
      select event_type, status
      from resend_webhook_events
      where email_message_id = $1
        or provider_message_id = $2
        or correlation_id = $3
      order by occurred_at, provider_event_id
    `,
    [message.id, message.provider_message_id, message.correlation_id]
  );
  return {
    correlationId: message.correlation_id,
    deliveryEventConflict: message.delivery_event_conflict,
    eventStatuses: eventResult.rows.map(({ status }) => status),
    eventTypes: eventResult.rows.map(({ event_type }) => event_type),
    lastErrorCode: message.last_error_code,
    messageStatus: message.status,
  };
};

try {
  const evidence = await verifyStagingResendLifecycle({
    attempts: ATTEMPTS,
    dependencies: {
      delay: async () => {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      },
      readEvidence,
      runWebhookWorker: async () => {
        const response = await fetch(`${origin}/api/cron/resend-webhooks`, {
          headers: { authorization: `Bearer ${cronSecret}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        await response.body?.cancel();
        return response.status;
      },
      startLifecycle: async () => {
        const response = await fetch(`${origin}/api/health/resend`, {
          body: '{"confirmation":"EMIT_RESEND_READINESS_EMAIL"}',
          headers: {
            authorization: `Bearer ${readinessSecret}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const body = (await response.json().catch(() => ({}))) as {
          correlationId?: string;
        };
        return {
          ...(body.correlationId ? { correlationId: body.correlationId } : {}),
          status: response.status,
        };
      },
    },
  });
  process.stdout.write(
    `${JSON.stringify({
      correlationId: evidence.correlationId,
      eventCount: evidence.eventTypes.length,
      eventTypes: evidence.eventTypes,
      match: true,
      messageStatus: evidence.messageStatus,
    })}\n`
  );
} finally {
  await pool.end();
}
