-- Custom SQL migration file, put your code below! --
INSERT INTO "course_versions" (
  "course_id",
  "version_number",
  "status",
  "title_snapshot",
  "workload_hours_snapshot",
  "published_at",
  "retired_at"
)
SELECT
  c."id",
  1,
  CASE
    WHEN c."status" = 'active' THEN 'published'::"course_version_status"
    WHEN c."status" = 'archived' THEN 'retired'::"course_version_status"
    ELSE 'draft'::"course_version_status"
  END,
  c."title",
  c."workload_hours",
  CASE WHEN c."status" = 'active' THEN c."updated_at" ELSE NULL END,
  CASE WHEN c."status" = 'archived' THEN c."updated_at" ELSE NULL END
FROM "courses" c;
--> statement-breakpoint

UPDATE "modules" m
SET "course_version_id" = cv."id"
FROM "course_versions" cv
WHERE cv."course_id" = m."course_id"
  AND cv."version_number" = 1;
--> statement-breakpoint

UPDATE "lessons" l
SET "course_version_id" = m."course_version_id"
FROM "modules" m
WHERE m."id" = l."module_id";
--> statement-breakpoint

UPDATE "enrollments" e
SET "course_version_id" = cv."id"
FROM "course_versions" cv
WHERE cv."course_id" = e."course_id"
  AND cv."version_number" = 1;
--> statement-breakpoint

UPDATE "certificates" cert
SET "course_version_id" = cv."id"
FROM "course_versions" cv
WHERE cv."course_id" = cert."course_id"
  AND cv."version_number" = 1;
--> statement-breakpoint

INSERT INTO "audit_logs" ("action", "target_type", "target_id", "metadata")
SELECT
  'course_version.backfilled',
  'course_version',
  cv."id"::text,
  jsonb_build_object(
    'courseId', cv."course_id",
    'migration', '0029_lush_goblin_queen',
    'versionNumber', cv."version_number"
  )
FROM "course_versions" cv
WHERE cv."version_number" = 1;
