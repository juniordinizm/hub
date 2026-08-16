ALTER TABLE "certificate_templates" DROP CONSTRAINT "certificate_templates_workload_hours_check";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "workload_hours_override" integer;--> statement-breakpoint
WITH legacy_workload AS (
  SELECT DISTINCT ON (course_id)
    course_id,
    certificate_workload_hours
  FROM "certificate_templates"
  WHERE certificate_workload_hours IS NOT NULL
  ORDER BY
    course_id,
    CASE status
      WHEN 'published' THEN 0
      WHEN 'draft' THEN 1
      ELSE 2
    END,
    version DESC
)
UPDATE "courses" AS course
SET workload_hours_override = legacy.certificate_workload_hours,
    workload_hours = legacy.certificate_workload_hours
FROM legacy_workload AS legacy
WHERE course.id = legacy.course_id
  AND course.workload_hours_override IS NULL;--> statement-breakpoint
ALTER TABLE "certificate_issuer_profiles" DROP COLUMN "course_free_statement";--> statement-breakpoint
ALTER TABLE "certificate_templates" DROP COLUMN "certificate_workload_hours";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_workload_hours_override_non_negative" CHECK ("courses"."workload_hours_override" is null or "courses"."workload_hours_override" >= 0);
