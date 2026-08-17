CREATE TYPE "public"."course_catalog_visibility" AS ENUM('listed', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."course_sales_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "course_sale_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"notification_enqueued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "catalog_visibility" "course_catalog_visibility" DEFAULT 'hidden' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "sales_status" "course_sales_status" DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "launch_date" date;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "launch_landing_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "interest_notifications_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "courses"
SET "catalog_visibility" = CASE
		WHEN status = 'active' THEN 'listed'::course_catalog_visibility
		ELSE 'hidden'::course_catalog_visibility
	END,
	"sales_status" = CASE
		WHEN status = 'active' THEN 'open'::course_sales_status
		ELSE 'closed'::course_sales_status
	END;--> statement-breakpoint
ALTER TABLE "course_sale_interests" ADD CONSTRAINT "course_sale_interests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_sale_interests" ADD CONSTRAINT "course_sale_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_sale_interests_course_user_unique_idx" ON "course_sale_interests" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX "course_sale_interests_notification_idx" ON "course_sale_interests" USING btree ("course_id","notification_enqueued_at");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_availability_combination_valid" CHECK ((
        "courses"."sales_status" = 'open'
        and "courses"."status" = 'active'
        and "courses"."catalog_visibility" = 'listed'
      ) or (
        "courses"."sales_status" = 'closed'
        and "courses"."status" in ('draft', 'active')
      ) or (
        "courses"."sales_status" = 'closed'
        and "courses"."status" = 'archived'
        and "courses"."catalog_visibility" = 'hidden'
      ));--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_interest_notifications_sent_non_negative" CHECK ("courses"."interest_notifications_sent" >= 0);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_launch_fields_only_for_coming_soon" CHECK ((
        "courses"."launch_date" is null and "courses"."launch_landing_url" is null
      ) or (
        "courses"."status" = 'draft'
        and "courses"."catalog_visibility" = 'listed'
        and "courses"."sales_status" = 'closed'
      ));
