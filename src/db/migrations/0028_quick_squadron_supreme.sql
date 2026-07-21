CREATE TYPE "public"."course_version_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "course_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "course_version_status" DEFAULT 'draft' NOT NULL,
	"title_snapshot" text NOT NULL,
	"workload_hours_snapshot" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_versions_number_positive" CHECK ("course_versions"."version_number" > 0),
	CONSTRAINT "course_versions_workload_non_negative" CHECK ("course_versions"."workload_hours_snapshot" >= 0)
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "course_version_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "course_version_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "course_version_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "is_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "course_version_id" uuid;--> statement-breakpoint
ALTER TABLE "course_versions" ADD CONSTRAINT "course_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_versions_course_number_unique_idx" ON "course_versions" USING btree ("course_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "course_versions_one_published_per_course_idx" ON "course_versions" USING btree ("course_id") WHERE "course_versions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "course_versions_course_status_idx" ON "course_versions" USING btree ("course_id","status");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_course_version_idx" ON "certificates" USING btree ("course_version_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_version_idx" ON "enrollments" USING btree ("course_version_id");--> statement-breakpoint
CREATE INDEX "lessons_course_version_idx" ON "lessons" USING btree ("course_version_id");--> statement-breakpoint
CREATE INDEX "modules_course_version_sort_idx" ON "modules" USING btree ("course_version_id","sort_order");