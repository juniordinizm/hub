CREATE TYPE "public"."jmvstream_delete_status" AS ENUM('none', 'pending', 'deleted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."jmvstream_folder_status" AS ENUM('active', 'failed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."jmvstream_folder_type" AS ENUM('course', 'module');--> statement-breakpoint
CREATE TYPE "public"."jmvstream_upload_status" AS ENUM('uploading', 'processing', 'ready');--> statement-breakpoint
CREATE TABLE "jmvstream_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid,
	"folder_uuid" text,
	"folder_type" "jmvstream_folder_type" NOT NULL,
	"name" text NOT NULL,
	"parent_folder_uuid" text,
	"status" "jmvstream_folder_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jmvstream_video_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"module_id" uuid,
	"lesson_id" uuid,
	"video_hash" text NOT NULL,
	"gallery_uuid" text,
	"filename" text NOT NULL,
	"size_bytes" bigint,
	"object_name" text,
	"upload_id" text,
	"job_id" text,
	"upload_status" "jmvstream_upload_status" DEFAULT 'processing' NOT NULL,
	"delete_status" "jmvstream_delete_status" DEFAULT 'none' NOT NULL,
	"delete_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jmvstream_folders" ADD CONSTRAINT "jmvstream_folders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jmvstream_folders" ADD CONSTRAINT "jmvstream_folders_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jmvstream_video_assets" ADD CONSTRAINT "jmvstream_video_assets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jmvstream_video_assets" ADD CONSTRAINT "jmvstream_video_assets_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jmvstream_video_assets" ADD CONSTRAINT "jmvstream_video_assets_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jmvstream_folders_folder_uuid_unique_idx" ON "jmvstream_folders" USING btree ("folder_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "jmvstream_folders_course_unique_idx" ON "jmvstream_folders" USING btree ("course_id") WHERE "jmvstream_folders"."folder_type" = 'course';--> statement-breakpoint
CREATE UNIQUE INDEX "jmvstream_folders_module_unique_idx" ON "jmvstream_folders" USING btree ("module_id") WHERE "jmvstream_folders"."module_id" is not null;--> statement-breakpoint
CREATE INDEX "jmvstream_folders_status_idx" ON "jmvstream_folders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "jmvstream_video_assets_hash_unique_idx" ON "jmvstream_video_assets" USING btree ("video_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "jmvstream_video_assets_active_lesson_unique_idx" ON "jmvstream_video_assets" USING btree ("lesson_id") WHERE "jmvstream_video_assets"."lesson_id" is not null and "jmvstream_video_assets"."delete_status" = 'none';--> statement-breakpoint
CREATE INDEX "jmvstream_video_assets_lesson_idx" ON "jmvstream_video_assets" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "jmvstream_video_assets_delete_status_idx" ON "jmvstream_video_assets" USING btree ("delete_status");
