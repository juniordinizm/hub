import "server-only";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import {
  isLearningAnalyticsEnabled,
  LEARNING_ANALYTICS_POLICY_VERSION,
  type LearningAnalyticsEventType,
} from "./rules";

const ERROR_CODE_PATTERN = /^[a-z0-9_.-]{1,80}$/i;

const validErrorCode = (value: string | undefined): string | null => {
  if (!(value && ERROR_CODE_PATTERN.test(value))) {
    return null;
  }
  return value;
};

export const setLearningAnalyticsPreference = async ({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: string;
}): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (enabled) {
      await client.query(
        "delete from learning_analytics_preferences where user_id = $1",
        [userId]
      );
    } else {
      await client.query(
        "delete from learning_analytics_events where user_id = $1",
        [userId]
      );
      await client.query(
        `
          insert into learning_analytics_preferences (user_id, enabled_at, disabled_at, policy_version)
          values ($1, null, now(), $2)
          on conflict (user_id) do update set
            enabled_at = null,
            disabled_at = now(),
            policy_version = excluded.policy_version,
            updated_at = now()
        `,
        [userId, LEARNING_ANALYTICS_POLICY_VERSION]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const getLearningAnalyticsPreference = async ({
  userId,
}: {
  userId: string;
}): Promise<boolean> => {
  const result = await getPool().query<{
    disabled_at: Date | null;
  }>(
    "select disabled_at from learning_analytics_preferences where user_id = $1",
    [userId]
  );
  return isLearningAnalyticsEnabled({
    disabledAt: result.rows[0]?.disabled_at ?? null,
  });
};

/**
 * Records a minimized event only after server-side authorization and no opt-out.
 * Analytics failures deliberately do not affect the learning transaction.
 */
export const recordLearningAnalyticsEvent = async ({
  checkpointPercent,
  errorCode,
  eventType,
  idempotencyKey,
  lessonId,
  userId,
}: {
  checkpointPercent?: number;
  errorCode?: string;
  eventType: LearningAnalyticsEventType;
  idempotencyKey: string;
  lessonId: string;
  userId: string;
}): Promise<void> => {
  const normalizedCheckpoint =
    checkpointPercent === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(checkpointPercent)));

  await getPool().query(
    `
      insert into learning_analytics_events (
        event_type, idempotency_key, user_id, enrollment_id, course_publication_id,
        lesson_id, checkpoint_percent, error_code
      )
      select $1, $2, e.user_id, e.id, l.course_publication_id, l.id, $3, $4
      from enrollments e
      left join learning_analytics_preferences preference on preference.user_id = e.user_id
      join lessons l on l.id = $5
      join course_publications cp on cp.id = l.course_publication_id
        and cp.course_id = e.course_id and cp.status = 'published'
      where e.user_id = $6
        and e.status = 'active'
        and e.expires_at > now()
        and preference.disabled_at is null
      on conflict (idempotency_key) do nothing
    `,
    [
      eventType,
      idempotencyKey,
      normalizedCheckpoint,
      validErrorCode(errorCode),
      lessonId,
      userId,
    ]
  );
};

export interface LessonAnalyticsMetric {
  completed: number;
  coursePublicationId: string;
  eligible: number;
  errorCount: number;
  lessonId: string;
  lessonTitle: string;
  medianCheckpointPercent: number | null;
  medianHoursToComplete: number | null;
  medianHoursToNextLesson: number | null;
  started: number;
}

export const getLessonAnalyticsMetrics = async (): Promise<
  LessonAnalyticsMetric[]
> => {
  await requirePermission("viewAdminPanel");
  const result = await getPool().query<{
    completed: string;
    course_publication_id: string;
    eligible: string;
    error_count: string;
    lesson_id: string;
    lesson_title: string;
    median_checkpoint_percent: number | null;
    median_hours_to_complete: number | null;
    median_hours_to_next_lesson: number | null;
    started: string;
  }>(`
    with analytics_events as (
      select course_publication_id, lesson_id, event_type,
             count(*)::int as event_count,
             count(distinct enrollment_id)::int as unique_enrollment_count
      from learning_analytics_events
      where occurred_at >= current_date
      group by course_publication_id, lesson_id, event_type
      union all
      select course_publication_id, lesson_id, event_type,
             event_count, unique_enrollment_count
      from learning_analytics_daily_metrics
      where metric_date < current_date
        and metric_date >= current_date - interval '13 months'
    ), analytics as (
      select course_publication_id, lesson_id,
             coalesce(sum(unique_enrollment_count) filter (where event_type = 'lesson_started'), 0)::int as started,
             coalesce(sum(event_count) filter (where event_type in ('player_error', 'resource_open_failed')), 0)::int as error_count
      from analytics_events
      group by course_publication_id, lesson_id
    ), eligible as (
      select cp.id as course_publication_id, count(*)::int as eligible
      from enrollments e
      join course_publications cp on cp.course_id = e.course_id and cp.status = 'published'
      left join learning_analytics_preferences preference on preference.user_id = e.user_id
      where e.status = 'active'
        and e.expires_at > now()
        and preference.disabled_at is null
      group by cp.id
    ), completed as (
      select lp.lesson_id, count(*)::int as completed
      from lesson_progress lp
      join lessons l on l.id = lp.lesson_id
      join enrollments e on e.user_id = lp.user_id
        and e.course_id = m.course_id
      join course_publications cp on cp.id = l.course_publication_id
        and cp.course_id = e.course_id and cp.status = 'published'
      left join learning_analytics_preferences preference on preference.user_id = lp.user_id
      where preference.disabled_at is null
      group by lp.lesson_id
    ), recent_starts as (
      select enrollment_id, user_id, lesson_id, min(occurred_at) as started_at
      from learning_analytics_events
      where event_type = 'lesson_started'
        and occurred_at >= now() - interval '90 days'
      group by enrollment_id, user_id, lesson_id
    ), checkpoint_by_enrollment as (
      select course_publication_id, lesson_id, enrollment_id,
             max(checkpoint_percent) as checkpoint_percent
      from learning_analytics_events
      where event_type = 'watch_checkpoint'
        and occurred_at >= now() - interval '90 days'
      group by course_publication_id, lesson_id, enrollment_id
    ), checkpoints as (
      select course_publication_id, lesson_id,
             percentile_cont(0.5) within group (order by checkpoint_percent) as median_checkpoint_percent
      from checkpoint_by_enrollment
      group by course_publication_id, lesson_id
    ), completion_timing as (
      select starts.lesson_id,
             percentile_cont(0.5) within group (
               order by extract(epoch from (lp.completed_at - starts.started_at)) / 3600
             ) as median_hours_to_complete
      from recent_starts starts
      join lesson_progress lp on lp.user_id = starts.user_id
        and lp.lesson_id = starts.lesson_id
      where lp.completed_at >= starts.started_at
      group by starts.lesson_id
    ), lesson_sequence as (
      select l.id as lesson_id, l.course_publication_id,
             row_number() over (partition by l.course_publication_id order by m.sort_order, l.sort_order) as sequence_position
      from lessons l
      join modules m on m.id = l.module_id
      where l.status = 'active' and m.status = 'active'
    ), next_lesson_timing as (
      select completed_progress.lesson_id,
             percentile_cont(0.5) within group (
               order by extract(epoch from (next_start.started_at - completed_progress.completed_at)) / 3600
             ) as median_hours_to_next_lesson
      from lesson_progress completed_progress
      join enrollments e on e.user_id = completed_progress.user_id
      join lesson_sequence current_lesson on current_lesson.lesson_id = completed_progress.lesson_id
      join course_publications cp on cp.id = current_lesson.course_publication_id
        and cp.course_id = e.course_id and cp.status = 'published'
      join lesson_sequence next_lesson on next_lesson.course_publication_id = current_lesson.course_publication_id
        and next_lesson.sequence_position = current_lesson.sequence_position + 1
      join recent_starts next_start on next_start.enrollment_id = e.id
        and next_start.lesson_id = next_lesson.lesson_id
      where completed_progress.completed_at >= now() - interval '90 days'
        and next_start.started_at >= completed_progress.completed_at
      group by completed_progress.lesson_id
    )
    select
      l.id as lesson_id,
      l.title as lesson_title,
      cp.id as course_publication_id,
      coalesce(eligible.eligible, 0) as eligible,
      coalesce(analytics.started, 0) as started,
      coalesce(completed.completed, 0) as completed,
      coalesce(analytics.error_count, 0) as error_count,
      checkpoints.median_checkpoint_percent,
      completion_timing.median_hours_to_complete,
      next_lesson_timing.median_hours_to_next_lesson
    from course_publications cp
    join modules m on m.course_publication_id = cp.id and m.status = 'active'
    join lessons l on l.course_publication_id = cp.id and l.module_id = m.id and l.status = 'active'
    left join eligible on eligible.course_publication_id = cp.id
    left join analytics on analytics.course_publication_id = cp.id and analytics.lesson_id = l.id
    left join completed on completed.lesson_id = l.id
    left join checkpoints on checkpoints.course_publication_id = cp.id and checkpoints.lesson_id = l.id
    left join completion_timing on completion_timing.lesson_id = l.id
    left join next_lesson_timing on next_lesson_timing.lesson_id = l.id
    order by cp.created_at desc, m.sort_order, l.sort_order
  `);
  return result.rows.map((row) => ({
    completed: Number(row.completed),
    coursePublicationId: row.course_publication_id,
    eligible: Number(row.eligible),
    errorCount: Number(row.error_count),
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    medianCheckpointPercent:
      row.median_checkpoint_percent === null
        ? null
        : Number(row.median_checkpoint_percent),
    medianHoursToComplete:
      row.median_hours_to_complete === null
        ? null
        : Number(row.median_hours_to_complete),
    medianHoursToNextLesson:
      row.median_hours_to_next_lesson === null
        ? null
        : Number(row.median_hours_to_next_lesson),
    started: Number(row.started),
  }));
};
