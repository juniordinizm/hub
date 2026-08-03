import "server-only";
import { getPool } from "@/db";

export interface OperationalBacklogSnapshot {
  alerts: OperationalAlert[];
  outbox: {
    deadLetters: number;
    oldestReadyAt: Date | null;
    ready: number;
  };
  payments: {
    uncertainCheckouts: number;
    uncorrelatedOrders: number;
    uncertainRefunds: number;
  };
  videos: {
    oldestPendingAt: Date | null;
    pending: number;
  };
  webhooks: {
    failed: number;
    oldestFailedAt: Date | null;
    oldestReadyAt: Date | null;
    oldestRetryAt: Date | null;
    ready: number;
    retryable: number;
  };
}

export interface OperationalAlert {
  code:
    | "webhook_failed_stale"
    | "webhook_payload_retention_risk"
    | "webhook_ready_stale"
    | "webhook_retry_stale";
  severity: "critical" | "high";
}

interface OperationalBacklogRow {
  dead_letters: string;
  oldest_outbox_at: Date | null;
  oldest_video_at: Date | null;
  oldest_webhook_failed_at: Date | null;
  oldest_webhook_ready_at: Date | null;
  oldest_webhook_retry_at: Date | null;
  outbox_ready: string;
  uncertain_checkouts: string;
  uncertain_refunds: string;
  uncorrelated_orders: string;
  videos_pending: string;
  webhooks_failed: string;
  webhooks_ready: string;
  webhooks_retryable: string;
}

const BACKLOG_STATUSES = "'pending', 'retrying', 'processing'";
const PENDING_VIDEO_STATUSES = "'uploading', 'processing'";

export const OPERATIONAL_BACKLOG_THRESHOLDS_MS = {
  webhookFailed: 24 * 60 * 60 * 1000,
  webhookPayloadRetentionWarning: 25 * 24 * 60 * 60 * 1000,
  webhookReady: 15 * 60 * 1000,
  webhookRetry: 6 * 60 * 60 * 1000,
} as const;

const isAtLeastAge = ({
  date,
  now,
  thresholdMs,
}: {
  date: Date | null;
  now: Date;
  thresholdMs: number;
}): boolean => Boolean(date && now.getTime() - date.getTime() >= thresholdMs);

const getWebhookAlerts = ({
  now,
  webhooks,
}: {
  now: Date;
  webhooks: OperationalBacklogSnapshot["webhooks"];
}): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  if (
    webhooks.ready > 0 &&
    isAtLeastAge({
      date: webhooks.oldestReadyAt,
      now,
      thresholdMs: OPERATIONAL_BACKLOG_THRESHOLDS_MS.webhookReady,
    })
  ) {
    alerts.push({ code: "webhook_ready_stale", severity: "high" });
  }
  if (
    webhooks.retryable > 0 &&
    isAtLeastAge({
      date: webhooks.oldestRetryAt,
      now,
      thresholdMs: OPERATIONAL_BACKLOG_THRESHOLDS_MS.webhookRetry,
    })
  ) {
    alerts.push({ code: "webhook_retry_stale", severity: "high" });
  }
  if (
    webhooks.failed > 0 &&
    isAtLeastAge({
      date: webhooks.oldestFailedAt,
      now,
      thresholdMs: OPERATIONAL_BACKLOG_THRESHOLDS_MS.webhookFailed,
    })
  ) {
    alerts.push({ code: "webhook_failed_stale", severity: "high" });
  }
  const oldestPayload = [
    webhooks.oldestReadyAt,
    webhooks.oldestRetryAt,
    webhooks.oldestFailedAt,
  ]
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (
    isAtLeastAge({
      date: oldestPayload ?? null,
      now,
      thresholdMs:
        OPERATIONAL_BACKLOG_THRESHOLDS_MS.webhookPayloadRetentionWarning,
    })
  ) {
    alerts.push({
      code: "webhook_payload_retention_risk",
      severity: "critical",
    });
  }
  return alerts;
};

export const getOperationalBacklogSnapshot = async ({
  now = () => new Date(),
}: {
  now?: () => Date;
} = {}): Promise<OperationalBacklogSnapshot> => {
  const { rows } = await getPool().query<OperationalBacklogRow>(`
    select
      (select count(*) from outbox_messages where status in (${BACKLOG_STATUSES})) as outbox_ready,
      (select min(created_at) from outbox_messages where status in (${BACKLOG_STATUSES})) as oldest_outbox_at,
      (select count(*) from outbox_messages where status = 'dead_letter') as dead_letters,
      (select count(*) from webhook_events where provider = 'asaas' and status = 'failed') as webhooks_failed,
      (select min(created_at) from webhook_events where provider = 'asaas' and status = 'failed') as oldest_webhook_failed_at,
      (select min(created_at) from webhook_events where provider = 'asaas' and status in ('received', 'processing')) as oldest_webhook_ready_at,
      (select min(created_at) from webhook_events where provider = 'asaas' and status = 'retryable') as oldest_webhook_retry_at,
      (select count(*) from webhook_events where provider = 'asaas' and status in ('received', 'processing')) as webhooks_ready,
      (select count(*) from webhook_events where provider = 'asaas' and status = 'retryable') as webhooks_retryable,
      (select count(*) from orders where provider = 'asaas' and checkout_status = 'uncertain') as uncertain_checkouts,
      (select count(*) from orders where provider = 'asaas' and status = 'paid' and provider_payment_id is null) as uncorrelated_orders,
      (select count(*) from refund_requests where status = 'uncertain') as uncertain_refunds,
      (select count(*) from jmvstream_video_assets where upload_status in (${PENDING_VIDEO_STATUSES})) as videos_pending,
      (select min(updated_at) from jmvstream_video_assets where upload_status in (${PENDING_VIDEO_STATUSES})) as oldest_video_at
  `);
  const row = rows[0];

  const webhooks: OperationalBacklogSnapshot["webhooks"] = {
    failed: Number(row?.webhooks_failed ?? 0),
    oldestFailedAt: row?.oldest_webhook_failed_at ?? null,
    oldestReadyAt: row?.oldest_webhook_ready_at ?? null,
    oldestRetryAt: row?.oldest_webhook_retry_at ?? null,
    ready: Number(row?.webhooks_ready ?? 0),
    retryable: Number(row?.webhooks_retryable ?? 0),
  };

  return {
    alerts: getWebhookAlerts({ now: now(), webhooks }),
    outbox: {
      deadLetters: Number(row?.dead_letters ?? 0),
      oldestReadyAt: row?.oldest_outbox_at ?? null,
      ready: Number(row?.outbox_ready ?? 0),
    },
    videos: {
      oldestPendingAt: row?.oldest_video_at ?? null,
      pending: Number(row?.videos_pending ?? 0),
    },
    payments: {
      uncertainCheckouts: Number(row?.uncertain_checkouts ?? 0),
      uncorrelatedOrders: Number(row?.uncorrelated_orders ?? 0),
      uncertainRefunds: Number(row?.uncertain_refunds ?? 0),
    },
    webhooks,
  };
};
