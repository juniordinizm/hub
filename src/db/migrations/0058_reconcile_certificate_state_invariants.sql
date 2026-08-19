-- Reconcile environments whose journal recorded 0056 without its catalog changes.
UPDATE "certificates"
SET "revoked_at" = COALESCE("revoked_at", "updated_at", "issued_at")
WHERE "status" = 'revoked' AND "revoked_at" IS NULL;
--> statement-breakpoint
UPDATE "certificates"
SET "revoked_reason_category" = 'other'
WHERE "status" = 'revoked'
  AND (
    "revoked_reason_category" IS NULL
    OR "revoked_reason_category" NOT IN (
      'identity_correction',
      'course_snapshot_correction',
      'eligibility_correction',
      'duplicate_or_technical_issue',
      'integrity_review',
      'legal_or_compliance',
      'other'
    )
  );
--> statement-breakpoint
UPDATE "certificates"
SET "revoked_at" = NULL,
    "revoked_reason" = NULL,
    "revoked_reason_category" = NULL,
    "revoked_by_user_id" = NULL
WHERE "status" = 'valid';
--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk"
  FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_revocation_state_check";
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revocation_state_check"
  CHECK (("certificates"."status" = 'revoked') = ("certificates"."revoked_at" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_revoked_reason_category_check";
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_reason_category_check"
  CHECK ("certificates"."revoked_reason_category" IS NULL OR "certificates"."revoked_reason_category" IN (
    'identity_correction',
    'course_snapshot_correction',
    'eligibility_correction',
    'duplicate_or_technical_issue',
    'integrity_review',
    'legal_or_compliance',
    'other'
  ));
--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_valid_revocation_fields_check";
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_valid_revocation_fields_check"
  CHECK ("certificates"."status" = 'revoked' OR (
    "certificates"."revoked_reason" IS NULL
    AND "certificates"."revoked_reason_category" IS NULL
    AND "certificates"."revoked_by_user_id" IS NULL
  ));
