CREATE TABLE "staged_lesson_resource_uploads" (
	"resource_id" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"preview_object_key" text,
	"lesson_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"content_type" text NOT NULL,
	"file_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"preview_content_type" text,
	"preview_size_bytes" integer,
	"preview_width" integer,
	"preview_height" integer,
	"status" text DEFAULT 'prepared' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staged_lesson_resource_uploads_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "staged_lesson_resource_uploads_status_check" CHECK ("staged_lesson_resource_uploads"."status" in ('prepared', 'uploaded', 'consumed')),
	CONSTRAINT "staged_lesson_resource_uploads_size_check" CHECK ("staged_lesson_resource_uploads"."size_bytes" > 0),
	CONSTRAINT "staged_lesson_resource_uploads_preview_check" CHECK ((
        "staged_lesson_resource_uploads"."preview_object_key" is null
        and "staged_lesson_resource_uploads"."preview_content_type" is null
        and "staged_lesson_resource_uploads"."preview_size_bytes" is null
        and "staged_lesson_resource_uploads"."preview_width" is null
        and "staged_lesson_resource_uploads"."preview_height" is null
      ) or (
        "staged_lesson_resource_uploads"."preview_object_key" is not null
        and "staged_lesson_resource_uploads"."preview_content_type" = 'image/webp'
        and "staged_lesson_resource_uploads"."preview_size_bytes" > 0
        and "staged_lesson_resource_uploads"."preview_width" > 0
        and "staged_lesson_resource_uploads"."preview_height" > 0
      ))
);
--> statement-breakpoint
ALTER TABLE "staged_lesson_resource_uploads" ADD CONSTRAINT "staged_lesson_resource_uploads_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staged_lesson_resource_uploads" ADD CONSTRAINT "staged_lesson_resource_uploads_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staged_lesson_resource_uploads_expiry_idx" ON "staged_lesson_resource_uploads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "staged_lesson_resource_uploads_lesson_actor_idx" ON "staged_lesson_resource_uploads" USING btree ("lesson_id","actor_user_id");