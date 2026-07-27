import { getPool } from "@/db";
import { reconcileRevokedCertificateArtifacts } from "@/features/certificates/artifact-reconciliation";
import { reconcileCertificateTemplateAssets } from "@/features/certificates/template-asset-cleanup";
import { reconcileStagedAdminImageUploads } from "@/features/storage/staged-image-reconciliation";

interface MaintenanceResult {
  certificateTemplateAssetsRemoved: number;
  deadlineReached: boolean;
  expiredRateLimitsRemoved: number;
  expiredSessionsRemoved: number;
  learningAnalyticsAggregated: number;
  learningAnalyticsEventsRemoved: number;
  leaseLost: boolean;
  revokedCertificateArtifactsReconciled: number;
  stagedAdminImagesRemoved: number;
}

const emptyMaintenanceResult = (): MaintenanceResult => ({
  certificateTemplateAssetsRemoved: 0,
  deadlineReached: false,
  expiredRateLimitsRemoved: 0,
  expiredSessionsRemoved: 0,
  learningAnalyticsAggregated: 0,
  learningAnalyticsEventsRemoved: 0,
  leaseLost: false,
  revokedCertificateArtifactsReconciled: 0,
  stagedAdminImagesRemoved: 0,
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
