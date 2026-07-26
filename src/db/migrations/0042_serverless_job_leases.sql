CREATE TABLE "certificate_template_asset_cleanup" (
	"object_key" text PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_token" uuid,
	"locked_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"last_error_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_template_asset_cleanup_status_check" CHECK ("certificate_template_asset_cleanup"."status" in ('pending', 'processing', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_leases" (
	"job_name" text PRIMARY KEY NOT NULL,
	"owner_token" uuid NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "certificate_template_asset_cleanup_due_idx" ON "certificate_template_asset_cleanup" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "certificate_template_asset_cleanup_locked_idx" ON "certificate_template_asset_cleanup" USING btree ("status","locked_at");