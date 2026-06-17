-- Custom SQL migration file, put your code below! --
UPDATE "courses"
SET "workload_hours" = "derived_workloads"."workload_hours",
    "updated_at" = now()
FROM (
  SELECT
    "courses"."id" AS "course_id",
    COALESCE(CEIL(SUM("lessons"."duration_seconds")::numeric / 3600), 0)::integer AS "workload_hours"
  FROM "courses"
  LEFT JOIN "modules" ON "modules"."course_id" = "courses"."id"
  LEFT JOIN "lessons" ON "lessons"."module_id" = "modules"."id"
  GROUP BY "courses"."id"
) AS "derived_workloads"
WHERE "courses"."id" = "derived_workloads"."course_id";
