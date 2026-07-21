import "server-only";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import {
  LEARNING_ANALYTICS_POLICY_VERSION,
  LEARNING_REENGAGEMENT_COOLDOWN_DAYS,
  type LearningAnalyticsEventType,
} from "./rules";

const ERROR_CODE_PATTERN = /^[a-z0-9_.-]{1,80}$/i;

const validErrorCode = (value: string | undefined): string | null => {
  if (!(value && ERROR_CODE_PATTERN.test(value))) {
    return null;
  }
  return value;
};

export const setLearningAnalyticsConsent = async ({
  consented,
  userId,
}: {
  consented: boolean;
  userId: string;
}): Promise<void> => {
  await getPool().query(
    `
      insert into learning_analytics_consents (user_id, consented_at, revoked_at, policy_version)
      values ($1, case when $2 then now() else null end, case when $2 then null else now() end, $3)
      on conflict (user_id) do update set
        consented_at = case when $2 then now() else learning_analytics_consents.consented_at end,
        revoked_at = case when $2 then null else now() end,
        policy_version = excluded.policy_version,
        updated_at = now()
    `,
    [userId, consented, LEARNING_ANALYTICS_POLICY_VERSION]
  );
};

export const getLearningAnalyticsConsent = async ({
  userId,
}: {
  userId: string;
}): Promise<boolean> => {
  const result = await getPool().query<{
    consented_at: Date | null;
    revoked_at: Date | null;
  }>(
    "select consented_at, revoked_at from learning_analytics_consents where user_id = $1",
    [userId]
  );
  const consent = result.rows[0];
  return Boolean(consent?.consented_at && !consent.revoked_at);
};

/**
 * Records a minimized event only after server-side authorization and active consent.
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
        event_type, idempotency_key, user_id, enrollment_id, course_version_id,
        lesson_id, checkpoint_percent, error_code
      )
      select $1, $2, e.user_id, e.id, e.course_version_id, l.id, $3, $4
      from enrollments e
      join learning_analytics_consents consent on consent.user_id = e.user_id
      join lessons l on l.id = $5 and l.course_version_id = e.course_version_id
      where e.user_id = $6
        and e.status = 'active'
        and e.expires_at > now()
        and consent.consented_at is not null
        and consent.revoked_at is null
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
  courseVersionId: string;
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
    course_version_id: string;
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
      select course_version_id, lesson_id, event_type,
             count(*)::int as event_count,
             count(distinct enrollment_id)::int as unique_enrollment_count
      from learning_analytics_events
      where occurred_at >= current_date
      group by course_version_id, lesson_id, event_type
      union all
      select course_version_id, lesson_id, event_type,
             event_count, unique_enrollment_count
      from learning_analytics_daily_metrics
      where metric_date < current_date
        and metric_date >= current_date - interval '13 months'
    ), analytics as (
      select course_version_id, lesson_id,
             coalesce(sum(unique_enrollment_count) filter (where event_type = 'lesson_started'), 0)::int as started,
             coalesce(sum(event_count) filter (where event_type in ('player_error', 'resource_open_failed')), 0)::int as error_count
      from analytics_events
      group by course_version_id, lesson_id
    ), eligible as (
      select course_version_id, count(*)::int as eligible
      from enrollments
      where status = 'active' and expires_at > now()
      group by course_version_id
    ), completed as (
      select lesson_id, count(*)::int as completed
      from lesson_progress
      group by lesson_id
    ), recent_starts as (
      select enrollment_id, user_id, lesson_id, min(occurred_at) as started_at
      from learning_analytics_events
      where event_type = 'lesson_started'
        and occurred_at >= now() - interval '90 days'
      group by enrollment_id, user_id, lesson_id
    ), checkpoint_by_enrollment as (
      select course_version_id, lesson_id, enrollment_id,
             max(checkpoint_percent) as checkpoint_percent
      from learning_analytics_events
      where event_type = 'watch_checkpoint'
        and occurred_at >= now() - interval '90 days'
      group by course_version_id, lesson_id, enrollment_id
    ), checkpoints as (
      select course_version_id, lesson_id,
             percentile_cont(0.5) within group (order by checkpoint_percent) as median_checkpoint_percent
      from checkpoint_by_enrollment
      group by course_version_id, lesson_id
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
      select l.id as lesson_id, l.course_version_id,
             row_number() over (partition by l.course_version_id order by m.sort_order, l.sort_order) as sequence_position
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
        and current_lesson.course_version_id = e.course_version_id
      join lesson_sequence next_lesson on next_lesson.course_version_id = current_lesson.course_version_id
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
      cv.id as course_version_id,
      coalesce(eligible.eligible, 0) as eligible,
      coalesce(analytics.started, 0) as started,
      coalesce(completed.completed, 0) as completed,
      coalesce(analytics.error_count, 0) as error_count,
      checkpoints.median_checkpoint_percent,
      completion_timing.median_hours_to_complete,
      next_lesson_timing.median_hours_to_next_lesson
    from course_versions cv
    join modules m on m.course_version_id = cv.id and m.status = 'active'
    join lessons l on l.course_version_id = cv.id and l.module_id = m.id and l.status = 'active'
    left join eligible on eligible.course_version_id = cv.id
    left join analytics on analytics.course_version_id = cv.id and analytics.lesson_id = l.id
    left join completed on completed.lesson_id = l.id
    left join checkpoints on checkpoints.course_version_id = cv.id and checkpoints.lesson_id = l.id
    left join completion_timing on completion_timing.lesson_id = l.id
    left join next_lesson_timing on next_lesson_timing.lesson_id = l.id
    order by cv.created_at desc, m.sort_order, l.sort_order
  `);
  return result.rows.map((row) => ({
    completed: Number(row.completed),
    courseVersionId: row.course_version_id,
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

export interface InactiveLearningEnrollment {
  courseTitle: string;
  enrollmentId: string;
  lastActivityAt: Date | null;
  studentName: string;
}

export const getInactiveLearningEnrollments = async (): Promise<
  InactiveLearningEnrollment[]
> => {
  await requirePermission("viewAdminPanel");
  const result = await getPool().query<{
    course_title: string;
    enrollment_id: string;
    last_activity_at: Date | null;
    student_name: string;
  }>(`
    select e.id as enrollment_id, users.name as student_name, courses.title as course_title,
           greatest(max(ae.occurred_at), max(lp.completed_at), max(lwp.last_event_at)) as last_activity_at
    from enrollments e
    join users on users.id = e.user_id
    join courses on courses.id = e.course_id
    join learning_analytics_consents consent on consent.user_id = e.user_id
    left join learning_analytics_events ae on ae.enrollment_id = e.id
    left join lesson_progress lp on lp.user_id = e.user_id
      and lp.lesson_id in (select id from lessons where course_version_id = e.course_version_id)
    left join lesson_watch_progress lwp on lwp.user_id = e.user_id
      and lwp.lesson_id in (select id from lessons where course_version_id = e.course_version_id)
    where e.status = 'active'
      and e.expires_at > now()
      and consent.consented_at is not null
      and consent.revoked_at is null
    group by e.id, users.name, courses.title
    having greatest(max(ae.occurred_at), max(lp.completed_at), max(lwp.last_event_at)) is null
      or greatest(max(ae.occurred_at), max(lp.completed_at), max(lwp.last_event_at)) < now() - interval '14 days'
    order by last_activity_at nulls first
    limit 100
  `);
  return result.rows.map((row) => ({
    courseTitle: row.course_title,
    enrollmentId: row.enrollment_id,
    lastActivityAt: row.last_activity_at,
    studentName: row.student_name,
  }));
};

export const initiateLearningReengagement = async ({
  actorUserId,
  enrollmentId,
  intent,
}: {
  actorUserId: string;
  enrollmentId: string;
  intent: string;
}): Promise<{ id: string }> => {
  const trimmedIntent = intent.trim();
  if (!(enrollmentId && trimmedIntent && trimmedIntent.length <= 500)) {
    throw new Error(
      "Informe a matricula e uma intencao de contato de ate 500 caracteres."
    );
  }

  const result = await getPool().query<{ id: string }>(
    `
      insert into learning_reengagements (enrollment_id, initiated_by_user_id, intent)
      select e.id, $2, $3
      from enrollments e
      join learning_analytics_consents consent on consent.user_id = e.user_id
      where e.id = $1
        and e.status = 'active'
        and e.expires_at > now()
        and consent.consented_at is not null
        and consent.revoked_at is null
        and not exists (
          select 1
          from learning_reengagements previous
          where previous.enrollment_id = e.id
            and previous.created_at > now() - interval '${LEARNING_REENGAGEMENT_COOLDOWN_DAYS} days'
        )
      returning id
    `,
    [enrollmentId, actorUserId, trimmedIntent]
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error("Matricula nao esta elegivel para contato manual.");
  }
  await getPool().query(
    `insert into audit_logs (actor_user_id, action, target_type, target_id)
     values ($1, 'learning_reengagement.initiated', 'learning_reengagement', $2)`,
    [actorUserId, id]
  );
  return { id };
};
