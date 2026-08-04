import { getPool } from "@/db";
import { reconcileRevokedCertificateArtifacts } from "@/features/certificates/artifact-reconciliation";
import { reconcileCertificateTemplateAssets } from "@/features/certificates/template-asset-cleanup";
import { sanitizeExpiredAsaasWebhookPayloads } from "@/features/payments/asaas-webhook-inbox";
import { reconcileStagedAdminImageUploads } from "@/features/storage/staged-image-reconciliation";

interface MaintenanceResult {
  certificateTemplateAssetsRemoved: number;
  checkoutReservationsRemoved: number;
  deadlineReached: boolean;
  expiredPaymentQuotesRemoved: number;
  expiredRateLimitsRemoved: number;
  expiredSessionsRemoved: number;
  learningAnalyticsAggregated: number;
  learningAnalyticsEventsRemoved: number;
  leaseLost: boolean;
  revokedCertificateArtifactsReconciled: number;
  stagedAdminImagesRemoved: number;
  webhookPayloadsSanitized: number;
}

const emptyMaintenanceResult = (): MaintenanceResult => ({
  certificateTemplateAssetsRemoved: 0,
  checkoutReservationsRemoved: 0,
  deadlineReached: false,
  expiredPaymentQuotesRemoved: 0,
  expiredRateLimitsRemoved: 0,
  expiredSessionsRemoved: 0,
  learningAnalyticsAggregated: 0,
  learningAnalyticsEventsRemoved: 0,
  leaseLost: false,
  revokedCertificateArtifactsReconciled: 0,
  stagedAdminImagesRemoved: 0,
  webhookPayloadsSanitized: 0,
});

export const runMaintenance = async ({
  clock = Date.now,
  deadlineAt = Number.POSITIVE_INFINITY,
  isLeaseOwner = async () => true,
}: {
  clock?: () => number;
  deadlineAt?: number;
  isLeaseOwner?: () => Promise<boolean>;
} = {}): Promise<MaintenanceResult> => {
  const result = emptyMaintenanceResult();
  const canContinue = async (): Promise<boolean> => {
    if (clock() >= deadlineAt) {
      result.deadlineReached = true;
      return false;
    }
    if (!(await isLeaseOwner())) {
      result.leaseLost = true;
      return false;
    }
    return true;
  };
  const pool = getPool();

  if (!(await canContinue())) {
    return result;
  }
  const sessions = await pool.query(
    "delete from sessions where expires_at < now()"
  );
  result.expiredSessionsRemoved = sessions.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  const rateLimits = await pool.query(
    "delete from public_certificate_rate_limits where expires_at < now()"
  );
  result.expiredRateLimitsRemoved = rateLimits.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  const checkoutRateLimits = await pool.query(
    "delete from public_checkout_rate_limits where expires_at < now()"
  );
  result.expiredRateLimitsRemoved += checkoutRateLimits.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  const expiredPaymentQuotes = await pool.query(`
    with expired_quotes as (
      select id
      from course_payment_quotes
      where expires_at < now() - interval '7 days'
        and not exists (
          select 1
          from orders
          where orders.payment_quote_id = course_payment_quotes.id
        )
      order by expires_at
      limit 500
      for update skip locked
    )
    delete from course_payment_quotes
    using expired_quotes
    where course_payment_quotes.id = expired_quotes.id
  `);
  result.expiredPaymentQuotesRemoved = expiredPaymentQuotes.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  const checkoutReservations = await pool.query(`
    with stale_reservations as (
      select id
      from orders
      where created_at < now() - interval '15 minutes'
        and provider = 'asaas'
        and status = 'pending'
        and checkout_status = 'pending'
        and provider_checkout_id is null
        and provider_payment_id is null
        and provider_customer_id is null
        and checkout_url is null
        and checkout_attempt_count = 0
        and checkout_last_attempt_at is null
        and checkout_next_attempt_at is null
        and checkout_error_message is null
        and provider_checkout_status is null
        and provider_payment_status is null
        and provider_risk_status is null
        and provider_settlement_status is null
        and provider_refund_status is null
        and provider_dispute_status is null
        and paid_amount_in_cents is null
        and payment_method is null
        and receipt_url is null
        and paid_at is null
        and refunded_at is null
      order by created_at
      limit 500
      for update skip locked
    )
    delete from orders
    using stale_reservations
    where orders.id = stale_reservations.id
  `);
  result.checkoutReservationsRemoved = checkoutReservations.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  result.webhookPayloadsSanitized = await sanitizeExpiredAsaasWebhookPayloads({
    client: pool,
  });

  if (!(await canContinue())) {
    return result;
  }
  const analytics = await pool.query(`
    insert into learning_analytics_daily_metrics (
      metric_date, event_type, course_publication_id, lesson_id,
      event_count, unique_enrollment_count
    )
    select occurred_at::date, event_type, course_publication_id, lesson_id,
           count(*)::int, count(distinct enrollment_id)::int
    from learning_analytics_events
    where occurred_at < date_trunc('day', now())
    group by occurred_at::date, event_type, course_publication_id, lesson_id
    on conflict (metric_date, event_type, course_publication_id, lesson_id)
    do update set event_count = excluded.event_count,
                  unique_enrollment_count = excluded.unique_enrollment_count,
                  updated_at = now()
  `);
  result.learningAnalyticsAggregated = analytics.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  const analyticsEvents = await pool.query(
    "delete from learning_analytics_events where occurred_at < now() - interval '90 days'"
  );
  result.learningAnalyticsEventsRemoved = analyticsEvents.rowCount ?? 0;

  if (!(await canContinue())) {
    return result;
  }
  await pool.query(
    "delete from learning_analytics_daily_metrics where metric_date < current_date - interval '13 months'"
  );

  if (!(await canContinue())) {
    return result;
  }
  result.revokedCertificateArtifactsReconciled =
    await reconcileRevokedCertificateArtifacts({ shouldContinue: canContinue });

  if (!(await canContinue())) {
    return result;
  }
  result.certificateTemplateAssetsRemoved =
    await reconcileCertificateTemplateAssets({ shouldContinue: canContinue });

  if (!(await canContinue())) {
    return result;
  }
  result.stagedAdminImagesRemoved = await reconcileStagedAdminImageUploads({
    shouldContinue: canContinue,
  });

  if (!(await canContinue())) {
    return result;
  }
  await pool.query(
    `
      insert into audit_logs (action, target_type, metadata)
      values ('maintenance.executed', 'maintenance', $1::jsonb)
    `,
    [JSON.stringify(result)]
  );

  return result;
};
