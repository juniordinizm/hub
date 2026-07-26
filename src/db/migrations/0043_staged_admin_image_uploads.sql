CREATE TABLE "staged_admin_image_uploads" (
	"object_key" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"content_type" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"owner_token" uuid,
	"locked_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staged_admin_image_uploads_status_check" CHECK ("staged_admin_image_uploads"."status" in ('prepared', 'ready', 'processing', 'consumed'))
);
--> statement-breakpoint
ALTER TABLE "staged_admin_image_uploads" ADD CONSTRAINT "staged_admin_image_uploads_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staged_admin_image_uploads_expiry_idx" ON "staged_admin_image_uploads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "staged_admin_image_uploads_actor_idx" ON "staged_admin_image_uploads" USING btree ("actor_user_id","aggregate_type","aggregate_id");