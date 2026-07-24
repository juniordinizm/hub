import "server-only";
import { getPool } from "@/db";
import { reconcileRevokedCertificateArtifacts } from "@/features/certificates/artifact-reconciliation";

export const runMaintenance = async (): Promise<{
  expiredRateLimitsRemoved: number;
  expiredSessionsRemoved: number;
  learningAnalyticsAggregated: number;
  learningAnalyticsEventsRemoved: number;
  revokedCertificateArtifactsReconciled: number;
}> => {
  const [sessions, rateLimits, analytics] = await Promise.all([
    getPool().query("delete from sessions where expires_at < now()"),
    getPool().query(
      "delete from public_certificate_rate_limits where expires_at < now()"
    ),
    getPool().query(`
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
    `),
  ]);
  const analyticsEvents = await getPool().query(
    "delete from learning_analytics_events where occurred_at < now() - interval '90 days'"
  );
  await getPool().query(
    "delete from learning_analytics_daily_metrics where metric_date < current_date - interval '13 months'"
  );
  const revokedCertificateArtifactsReconciled =
    await reconcileRevokedCertificateArtifacts();
  await getPool().query(
    `
      insert into audit_logs (action, target_type, metadata)
      values ('maintenance.executed', 'maintenance', $1::jsonb)
    `,
    [
      JSON.stringify({
        expiredRateLimitsRemoved: rateLimits.rowCount ?? 0,
        expiredSessionsRemoved: sessions.rowCount ?? 0,
        learningAnalyticsAggregated: analytics.rowCount ?? 0,
        learningAnalyticsEventsRemoved: analyticsEvents.rowCount ?? 0,
        revokedCertificateArtifactsReconciled,
      }),
    ]
  );

  return {
    expiredRateLimitsRemoved: rateLimits.rowCount ?? 0,
    expiredSessionsRemoved: sessions.rowCount ?? 0,
    learningAnalyticsAggregated: analytics.rowCount ?? 0,
    learningAnalyticsEventsRemoved: analyticsEvents.rowCount ?? 0,
    revokedCertificateArtifactsReconciled,
  };
};
