CREATE TYPE "public"."course_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('video', 'presentation', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'support', 'student');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('panda', 'jmvstream', 'external');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"support_whatsapp_url" text,
	"certificate_signer_name" text,
	"certificate_signer_role" text,
	"abacatepay_webhook_secret_last4" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"student_name_snapshot" text NOT NULL,
	"course_title_snapshot" text NOT NULL,
	"workload_hours_snapshot" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"instructor_name" text,
	"workload_hours" integer DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"support_whatsapp_url" text,
	"payment_provider_product_id" text,
	"access_duration_months" integer DEFAULT 12 NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_access_duration_positive" CHECK ("courses"."access_duration_months" > 0),
	CONSTRAINT "courses_workload_hours_non_negative" CHECK ("courses"."workload_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT 'geral' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"lesson_type" "lesson_type" DEFAULT 'video' NOT NULL,
	"video_provider" "video_provider",
	"video_external_id" text,
	"video_embed_url" text,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"sort_order" integer NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_duration_non_negative" CHECK ("lessons"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"color" text DEFAULT '#326c71' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text,
	"provider" text DEFAULT 'abacatepay' NOT NULL,
	"provider_order_id" text NOT NULL,
	"external_id" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"amount_in_cents" integer DEFAULT 0 NOT NULL,
	"paid_amount_in_cents" integer,
	"payment_method" text,
	"receipt_url" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"customer_email" text,
	"customer_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "role" DEFAULT 'student' NOT NULL,
	"phone" text,
	"invited_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'abacatepay' NOT NULL,
	"event_key" text NOT NULL,
	"event_name" text NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_unique_idx" ON "certificates" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_unique_idx" ON "enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_status_idx" ON "enrollments" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_expires_at_idx" ON "enrollments" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "faq_items_sort_idx" ON "faq_items" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_user_lesson_unique_idx" ON "lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_user_idx" ON "lesson_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lessons_module_sort_idx" ON "lessons" USING btree ("module_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_module_sort_unique_idx" ON "lessons" USING btree ("module_id","sort_order");--> statement-breakpoint
CREATE INDEX "modules_course_sort_idx" ON "modules" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_course_sort_unique_idx" ON "modules" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_order_unique_idx" ON "orders" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_external_unique_idx" ON "orders" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "orders_course_status_idx" ON "orders" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_key_unique_idx" ON "webhook_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");