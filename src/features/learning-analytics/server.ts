import "server-only";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import {
  APP_CURRENT_DATE_SQL,
  APP_CURRENT_DAY_START_SQL,
} from "@/lib/timezone";
import {
  DEFAULT_LEARNING_ANALYTICS_PERIOD,
  type LearningAnalyticsPeriod,
  parseLearningAnalyticsPeriod,
} from "./period";
import {
  isLearningAnalyticsEnabled,
  LEARNING_ANALYTICS_POLICY_VERSION,
  type LearningAnalyticsEventType,
} from "./rules";
import type {
  LearningAnalyticsCourseOption,
  LessonAnalyticsMetric,
  LessonAnalyticsMetricPage,
  LessonAnalyticsMetricQuery,
} from "./types";

export type {
  LearningAnalyticsCourseOption,
  LearningAnalyticsKpis,
  LearningAnalyticsPeriod,
  LessonAnalyticsLessonReport,
  LessonAnalyticsMetric,
  LessonAnalyticsMetricPage,
  LessonAnalyticsMetricQuery,
  LessonAnalyticsPublicationStatus,
  LessonAnalyticsVersionMetric,
} from "./types";

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
      join courses c on c.id = e.course_id and c.status = 'active'
      join course_publications cp on cp.id = l.course_publication_id
        and cp.course_id = e.course_id and cp.status = 'published'
      where e.user_id = $6
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
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

const DEFAULT_LESSON_ANALYTICS_PAGE_SIZE = 20;
const MAX_LESSON_ANALYTICS_PAGE_SIZE = 100;

const LEARNING_ANALYTICS_PERIOD_INTERVALS: Record<
  LearningAnalyticsPeriod,
  string
> = {
  "12m": "12 months",
  "30d": "1 month",
  "90d": "3 months",
  "6m": "6 months",
};

const LEARNING_ANALYTICS_TIMING_INTERVALS: Record<
  LearningAnalyticsPeriod,
  string
> = {
  "12m": "12 months",
  "30d": "1 month",
  "90d": "3 months",
  "6m": "6 months",
};

const getLessonAnalyticsMetricsQuery = (
  period: LearningAnalyticsPeriod
): string => {
  const periodInterval = LEARNING_ANALYTICS_PERIOD_INTERVALS[period];
  const periodStartDateSql = `(${APP_CURRENT_DATE_SQL} - interval '${periodInterval}')::date`;
  const periodStartTimestampSql = `now() - interval '${periodInterval}'`;
  const timingStartSql = `now() - interval '${LEARNING_ANALYTICS_TIMING_INTERVALS[period]}'`;

  return `
    with analytics_events as (
      select course_publication_id, lesson_id, event_type,
             count(*)::int as event_count,
             count(distinct enrollment_id)::int as unique_enrollment_count
      from learning_analytics_events
      where occurred_at >= ${APP_CURRENT_DAY_START_SQL}
      group by course_publication_id, lesson_id, event_type
      union all
      select course_publication_id, lesson_id, event_type,
             event_count, unique_enrollment_count
      from learning_analytics_daily_metrics
      where metric_date < ${APP_CURRENT_DATE_SQL}
        and metric_date >= ${periodStartDateSql}
    ), analytics as (
      select course_publication_id, lesson_id,
             coalesce(sum(unique_enrollment_count) filter (where event_type = 'lesson_started'), 0)::int as started,
             coalesce(sum(event_count) filter (where event_type in ('player_error', 'resource_open_failed')), 0)::int as error_count
      from analytics_events
      group by course_publication_id, lesson_id
    ), active_enrollment_users as (
      select e.id as enrollment_id, e.user_id, e.course_id
      from enrollments e
      join courses c on c.id = e.course_id and c.status = 'active'
      left join learning_analytics_preferences preference on preference.user_id = e.user_id
      where e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and preference.disabled_at is null
    ), active_enrollments as (
      select cp.id as course_publication_id, count(*)::int as active_enrollments
      from active_enrollment_users e
      join course_publications cp on cp.course_id = e.course_id and cp.status = 'published'
      group by cp.id
    ), completed_by_lesson as (
      select lp.lesson_id, count(distinct lp.user_id)::int as completed
      from lesson_progress lp
      left join learning_analytics_preferences preference on preference.user_id = lp.user_id
      where preference.disabled_at is null
        and lp.completed_at >= ${periodStartTimestampSql}
      group by lp.lesson_id
    ), completed_by_curriculum as (
      select cp.course_id, l.curriculum_key, lp.user_id
      from lesson_progress lp
      join lessons l on l.id = lp.lesson_id
      join course_publications cp on cp.id = l.course_publication_id
      join active_enrollment_users enrollment
        on enrollment.user_id = lp.user_id and enrollment.course_id = cp.course_id
      where lp.completed_at >= ${periodStartTimestampSql}
      group by cp.course_id, l.curriculum_key, lp.user_id
    ), recent_starts as (
      select enrollment_id, user_id, lesson_id, min(occurred_at) as started_at
      from learning_analytics_events
      where event_type = 'lesson_started'
        and occurred_at >= ${timingStartSql}
      group by enrollment_id, user_id, lesson_id
    ), checkpoint_by_enrollment as (
      select course_publication_id, lesson_id, enrollment_id,
             max(checkpoint_percent) as checkpoint_percent
      from learning_analytics_events
      where event_type = 'watch_checkpoint'
        and occurred_at >= ${timingStartSql}
      group by course_publication_id, lesson_id, enrollment_id
    ), checkpoints as (
      select course_publication_id, lesson_id,
             percentile_cont(0.5) within group (order by checkpoint_percent) as median_checkpoint_percent
      from checkpoint_by_enrollment
      group by course_publication_id, lesson_id
    ), curriculum_checkpoints as (
      select cp.course_id, l.curriculum_key,
             percentile_cont(0.5) within group (order by checkpoint_by_enrollment.checkpoint_percent) as median_checkpoint_percent
      from checkpoint_by_enrollment
      join lessons l on l.id = checkpoint_by_enrollment.lesson_id
      join course_publications cp on cp.id = checkpoint_by_enrollment.course_publication_id
      group by cp.course_id, l.curriculum_key
    ), checkpoint_by_curriculum as (
      select cp.course_id, l.curriculum_key, checkpoint_by_enrollment.enrollment_id,
             max(checkpoint_by_enrollment.checkpoint_percent) as checkpoint_percent
      from checkpoint_by_enrollment
      join lessons l on l.id = checkpoint_by_enrollment.lesson_id
      join course_publications cp on cp.id = checkpoint_by_enrollment.course_publication_id
      group by cp.course_id, l.curriculum_key, checkpoint_by_enrollment.enrollment_id
    ), completion_timing_samples as (
      select starts.lesson_id,
             starts.user_id,
             extract(epoch from (lp.completed_at - starts.started_at)) / 3600 as hours
      from recent_starts starts
      join lesson_progress lp on lp.user_id = starts.user_id
        and lp.lesson_id = starts.lesson_id
      where lp.completed_at >= starts.started_at
    ), completion_timing as (
      select lesson_id,
             percentile_cont(0.5) within group (order by hours) as median_hours_to_complete
      from completion_timing_samples
      group by lesson_id
    ), curriculum_completion_timing as (
      select cp.course_id, l.curriculum_key,
             percentile_cont(0.5) within group (order by completion_timing_samples.hours) as median_hours_to_complete
      from completion_timing_samples
      join lessons l on l.id = completion_timing_samples.lesson_id
      join course_publications cp on cp.id = l.course_publication_id
      group by cp.course_id, l.curriculum_key
    ), lesson_sequence as (
      select l.id as lesson_id, l.course_publication_id,
             row_number() over (partition by l.course_publication_id order by m.sort_order, l.sort_order) as sequence_position
      from lessons l
      join modules m on m.id = l.module_id
      where l.status = 'active' and m.status = 'active'
    ), next_lesson_timing_samples as (
      select completed_progress.lesson_id,
             extract(epoch from (next_start.started_at - completed_progress.completed_at)) / 3600 as hours
      from lesson_progress completed_progress
      join enrollments e on e.user_id = completed_progress.user_id
      join lesson_sequence current_lesson on current_lesson.lesson_id = completed_progress.lesson_id
      join course_publications cp on cp.id = current_lesson.course_publication_id
        and cp.course_id = e.course_id
      join lesson_sequence next_lesson on next_lesson.course_publication_id = current_lesson.course_publication_id
        and next_lesson.sequence_position = current_lesson.sequence_position + 1
      join recent_starts next_start on next_start.enrollment_id = e.id
        and next_start.lesson_id = next_lesson.lesson_id
      where completed_progress.completed_at >= ${timingStartSql}
        and next_start.started_at >= completed_progress.completed_at
    ), next_lesson_timing as (
      select lesson_id,
             percentile_cont(0.5) within group (order by hours) as median_hours_to_next_lesson
      from next_lesson_timing_samples
      group by lesson_id
    ), curriculum_next_lesson_timing as (
      select cp.course_id, l.curriculum_key,
             percentile_cont(0.5) within group (order by next_lesson_timing_samples.hours) as median_hours_to_next_lesson
      from next_lesson_timing_samples
      join lessons l on l.id = next_lesson_timing_samples.lesson_id
      join course_publications cp on cp.id = l.course_publication_id
      group by cp.course_id, l.curriculum_key
    ), course_viewing_by_enrollment as (
      select current_publication.course_id, enrollment.enrollment_id,
             avg(
               case
                 when completed.user_id is not null then 100
                 else coalesce(checkpoint.checkpoint_percent, 0)
               end
             ) as course_viewing_percent
      from active_enrollment_users enrollment
      join course_publications current_publication
        on current_publication.course_id = enrollment.course_id
        and current_publication.status = 'published'
      join modules current_module
        on current_module.course_publication_id = current_publication.id
        and current_module.status = 'active'
      join lessons current_lesson
        on current_lesson.course_publication_id = current_publication.id
        and current_lesson.module_id = current_module.id
        and current_lesson.status = 'active'
      left join checkpoint_by_curriculum checkpoint
        on checkpoint.course_id = current_publication.course_id
        and checkpoint.curriculum_key = current_lesson.curriculum_key
        and checkpoint.enrollment_id = enrollment.enrollment_id
      left join completed_by_curriculum completed
        on completed.course_id = current_publication.course_id
        and completed.curriculum_key = current_lesson.curriculum_key
        and completed.user_id = enrollment.user_id
      group by current_publication.course_id, enrollment.enrollment_id
    ), course_viewing as (
      select course_id, avg(course_viewing_percent) as average_course_viewing_percent
      from course_viewing_by_enrollment
      group by course_id
    )
    select
      c.id as course_id,
      c.title as course_title,
      l.id as lesson_id,
      l.curriculum_key,
      l.title as lesson_title,
      l.sort_order as lesson_sort_order,
      m.title as module_title,
      m.sort_order as module_sort_order,
      cp.id as course_publication_id,
      cp.status as publication_status,
      cp.publication_number,
      coalesce(active_enrollments.active_enrollments, 0) as active_enrollments,
      coalesce(analytics.started, 0) as started,
      coalesce(completed_by_lesson.completed, 0) as completed,
      coalesce(analytics.error_count, 0) as error_count,
      checkpoints.median_checkpoint_percent,
      completion_timing.median_hours_to_complete,
      next_lesson_timing.median_hours_to_next_lesson,
      curriculum_checkpoints.median_checkpoint_percent as aggregate_median_checkpoint_percent,
      curriculum_completion_timing.median_hours_to_complete as aggregate_median_hours_to_complete,
      curriculum_next_lesson_timing.median_hours_to_next_lesson as aggregate_median_hours_to_next_lesson,
      course_viewing.average_course_viewing_percent as course_average_viewing_percent,
      count(*) over()::int as total_count
    from course_publications cp
    join courses c on c.id = cp.course_id
    join modules m on m.course_publication_id = cp.id and m.status = 'active'
    join lessons l on l.course_publication_id = cp.id and l.module_id = m.id and l.status = 'active'
    left join active_enrollments
      on active_enrollments.course_publication_id = cp.id
    left join analytics on analytics.course_publication_id = cp.id and analytics.lesson_id = l.id
    left join completed_by_lesson on completed_by_lesson.lesson_id = l.id
    left join checkpoints on checkpoints.course_publication_id = cp.id and checkpoints.lesson_id = l.id
    left join completion_timing on completion_timing.lesson_id = l.id
    left join next_lesson_timing on next_lesson_timing.lesson_id = l.id
    left join curriculum_checkpoints
      on curriculum_checkpoints.course_id = c.id
      and curriculum_checkpoints.curriculum_key = l.curriculum_key
    left join curriculum_completion_timing
      on curriculum_completion_timing.course_id = c.id
      and curriculum_completion_timing.curriculum_key = l.curriculum_key
    left join curriculum_next_lesson_timing
      on curriculum_next_lesson_timing.course_id = c.id
      and curriculum_next_lesson_timing.curriculum_key = l.curriculum_key
    left join course_viewing on course_viewing.course_id = c.id
    `;
};

const readLessonAnalyticsMetrics = async ({
  courseId,
  page,
  pageSize,
  period,
}: {
  courseId?: string;
  page: number | null;
  pageSize: number;
  period: LearningAnalyticsPeriod;
}): Promise<LessonAnalyticsMetricPage> => {
  const normalizedCourseId = courseId?.trim() ?? "";
  const courseFilterSql = normalizedCourseId
    ? "\n    where c.status = 'active' and cp.status in ('published', 'retired') and c.id::text = $1"
    : "\n    where c.status = 'active' and cp.status in ('published', 'retired')";
  const paginationParameterOffset = normalizedCourseId ? 1 : 0;
  const paginationSql =
    page === null
      ? ""
      : `\n    limit $${paginationParameterOffset + 1} offset $${paginationParameterOffset + 2}`;
  const paginationParameters = [
    ...(normalizedCourseId ? [normalizedCourseId] : []),
    ...(page === null ? [] : [pageSize + 1, (page - 1) * pageSize]),
  ];
  const result = await getPool().query<{
    active_enrollments: string;
    completed: string;
    course_id: string;
    course_publication_id: string;
    course_title: string;
    curriculum_key: string;
    error_count: string;
    lesson_id: string;
    lesson_sort_order: number;
    lesson_title: string;
    median_checkpoint_percent: number | null;
    median_hours_to_complete: number | null;
    median_hours_to_next_lesson: number | null;
    aggregate_median_checkpoint_percent: number | null;
    aggregate_median_hours_to_complete: number | null;
    aggregate_median_hours_to_next_lesson: number | null;
    course_average_viewing_percent: number | null;
    module_sort_order: number;
    module_title: string;
    publication_number: number;
    publication_status: LessonAnalyticsMetric["publicationStatus"];
    started: string;
    total_count: number;
  }>(
    `${getLessonAnalyticsMetricsQuery(period)}${courseFilterSql}
    order by c.title, m.sort_order, l.sort_order, cp.publication_number desc${paginationSql}`,
    paginationParameters
  );
  const metrics = result.rows
    .slice(0, page === null ? undefined : pageSize)
    .map((row) => ({
      activeEnrollments: Number(row.active_enrollments),
      completed: Number(row.completed),
      courseId: row.course_id,
      coursePublicationId: row.course_publication_id,
      courseTitle: row.course_title,
      curriculumKey: row.curriculum_key,
      errorCount: Number(row.error_count),
      lessonId: row.lesson_id,
      lessonSortOrder: row.lesson_sort_order,
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
      aggregateMedianCheckpointPercent:
        row.aggregate_median_checkpoint_percent === null
          ? null
          : Number(row.aggregate_median_checkpoint_percent),
      aggregateMedianHoursToComplete:
        row.aggregate_median_hours_to_complete === null
          ? null
          : Number(row.aggregate_median_hours_to_complete),
      aggregateMedianHoursToNextLesson:
        row.aggregate_median_hours_to_next_lesson === null
          ? null
          : Number(row.aggregate_median_hours_to_next_lesson),
      courseAverageViewingPercent:
        row.course_average_viewing_percent === null
          ? null
          : Number(row.course_average_viewing_percent),
      moduleSortOrder: row.module_sort_order,
      moduleTitle: row.module_title,
      publicationNumber: row.publication_number,
      publicationStatus: row.publication_status,
      started: Number(row.started),
    }));
  let totalCount = result.rows[0]?.total_count ?? result.rows.length;
  if (result.rows.length === 0 && page !== null && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      `
      select count(*)::int as total_count
      from course_publications cp
      join courses c on c.id = cp.course_id
      join modules m on m.course_publication_id = cp.id and m.status = 'active'
      join lessons l
        on l.course_publication_id = cp.id
        and l.module_id = m.id
        and l.status = 'active'
      ${courseFilterSql}
    `,
      normalizedCourseId ? [normalizedCourseId] : []
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    hasNextPage: page !== null && result.rows.length > pageSize,
    metrics,
    page: page ?? 1,
    pageSize: page === null ? metrics.length : pageSize,
    totalCount,
  };
};

export const getLearningAnalyticsCourseOptions = async (): Promise<
  LearningAnalyticsCourseOption[]
> => {
  await requirePermission("manageLearningAnalytics");
  const { rows } = await getPool().query<{
    id: string;
    lesson_count: string;
    publication_number: number;
    title: string;
  }>(`
    select
      c.id,
      c.title,
      cp.publication_number,
      count(distinct l.id)::int as lesson_count
    from courses c
    join course_publications cp
      on cp.course_id = c.id and cp.status = 'published'
    join modules m
      on m.course_publication_id = cp.id and m.status = 'active'
    join lessons l
      on l.course_publication_id = cp.id
      and l.module_id = m.id
      and l.status = 'active'
    where c.status = 'active'
    group by c.id, c.title, cp.publication_number
    order by c.title, c.id
  `);

  return rows.map((row) => ({
    id: row.id,
    lessonCount: Number(row.lesson_count),
    publicationNumber: row.publication_number,
    title: row.title,
  }));
};

export const getLessonAnalyticsMetrics = async ({
  courseId,
  period = DEFAULT_LEARNING_ANALYTICS_PERIOD,
}: {
  courseId?: string;
  period?: LearningAnalyticsPeriod;
} = {}): Promise<LessonAnalyticsMetric[]> => {
  await requirePermission("manageLearningAnalytics");
  return (
    await readLessonAnalyticsMetrics({
      ...(courseId ? { courseId } : {}),
      page: null,
      pageSize: 0,
      period: parseLearningAnalyticsPeriod(period),
    })
  ).metrics;
};

export const getLessonAnalyticsMetricsPage = async (
  options: LessonAnalyticsMetricQuery = {}
): Promise<LessonAnalyticsMetricPage> => {
  await requirePermission("manageLearningAnalytics");
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(1000, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_LESSON_ANALYTICS_PAGE_SIZE
  );
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_LESSON_ANALYTICS_PAGE_SIZE, Math.max(1, requestedPageSize))
    : DEFAULT_LESSON_ANALYTICS_PAGE_SIZE;

  return await readLessonAnalyticsMetrics({
    ...(options.courseId ? { courseId: options.courseId } : {}),
    page,
    pageSize,
    period: parseLearningAnalyticsPeriod(options.period),
  });
};
