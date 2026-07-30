import "server-only";
import { getPool } from "@/db";

export interface OperationalBacklogSnapshot {
  outbox: {
    deadLetters: number;
    oldestReadyAt: Date | null;
    ready: number;
  };
  payments: {
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
    ready: number;
  };
}

interface OperationalBacklogRow {
  dead_letters: string;
  oldest_outbox_at: Date | null;
  oldest_video_at: Date | null;
  oldest_webhook_at: Date | null;
  outbox_ready: string;
  uncertain_refunds: string;
  uncorrelated_orders: string;
  videos_pending: string;
  webhooks_failed: string;
  webhooks_ready: string;
}

const BACKLOG_STATUSES = "'pending', 'retrying', 'processing'";
const PENDING_VIDEO_STATUSES = "'uploading', 'processing'";

export const getOperationalBacklogSnapshot =
  async (): Promise<OperationalBacklogSnapshot> => {
    const { rows } = await getPool().query<OperationalBacklogRow>(`
    select
      (select count(*) from outbox_messages where status in (${BACKLOG_STATUSES})) as outbox_ready,
      (select min(created_at) from outbox_messages where status in (${BACKLOG_STATUSES})) as oldest_outbox_at,
      (select count(*) from outbox_messages where status = 'dead_letter') as dead_letters,
      (select count(*) from webhook_events where provider = 'asaas' and status = 'failed') as webhooks_failed,
      (select min(created_at) from webhook_events where provider = 'asaas' and status = 'failed') as oldest_webhook_at,
      (select count(*) from webhook_events where provider = 'asaas' and status in ('received', 'processing', 'retryable')) as webhooks_ready,
      (select count(*) from orders where provider = 'asaas' and status = 'paid' and provider_payment_id is null) as uncorrelated_orders,
      (select count(*) from refund_requests where status = 'uncertain') as uncertain_refunds,
      (select count(*) from jmvstream_video_assets where upload_status in (${PENDING_VIDEO_STATUSES})) as videos_pending,
      (select min(updated_at) from jmvstream_video_assets where upload_status in (${PENDING_VIDEO_STATUSES})) as oldest_video_at
  `);
    const row = rows[0];

    return {
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
        uncorrelatedOrders: Number(row?.uncorrelated_orders ?? 0),
        uncertainRefunds: Number(row?.uncertain_refunds ?? 0),
      },
      webhooks: {
        failed: Number(row?.webhooks_failed ?? 0),
        oldestFailedAt: row?.oldest_webhook_at ?? null,
        ready: Number(row?.webhooks_ready ?? 0),
      },
    };
  };
