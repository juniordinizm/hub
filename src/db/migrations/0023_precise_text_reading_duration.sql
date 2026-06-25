with recalculated_lessons as (
  select
    id,
    case
      when text_word_count > 0
        then greatest(1, round(text_word_count::numeric / 260 * 60))::integer
      else 0
    end as recalculated_text_duration_seconds
  from lessons
)
update lessons
set text_duration_seconds = recalculated_lessons.recalculated_text_duration_seconds,
    duration_seconds = video_duration_seconds + recalculated_lessons.recalculated_text_duration_seconds,
    updated_at = now()
from recalculated_lessons
where lessons.id = recalculated_lessons.id
  and lessons.text_duration_seconds <> recalculated_lessons.recalculated_text_duration_seconds;

update courses
set workload_hours = derived_workloads.workload_hours,
    updated_at = now()
from (
  select
    courses.id as course_id,
    coalesce(ceil(sum(lessons.duration_seconds)::numeric / 3600), 0)::integer as workload_hours
  from courses
  left join modules on modules.course_id = courses.id
  left join lessons on lessons.module_id = modules.id
  group by courses.id
) as derived_workloads
where courses.id = derived_workloads.course_id;
