CREATE TYPE "public"."enrollment_grant_status" AS ENUM('active', 'expired', 'refunded', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."enrollment_grant_source_type" AS ENUM('abacatepay_order');--> statement-breakpoint
CREATE TYPE "public"."enrollment_adjustment_type" AS ENUM('extend_days', 'extend_months', 'set_exact_expiration', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."enrollment_event_type" AS ENUM('payment_paid', 'payment_refunded', 'payment_disputed', 'expiration_extended', 'expiration_set', 'expiration_adjustment_reversed', 'projection_rebuilt');--> statement-breakpoint
CREATE TABLE "enrollment_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"source_type" "enrollment_grant_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "enrollment_grant_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"base_expires_at" timestamp with time zone NOT NULL,
	"effective_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_grants_effective_after_start" CHECK ("enrollment_grants"."effective_expires_at" > "enrollment_grants"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "enrollment_expiration_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"adjustment_type" "enrollment_adjustment_type" NOT NULL,
	"delta_days" integer,
	"delta_months" integer,
	"previous_expires_at" timestamp with time zone NOT NULL,
	"new_expires_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" text,
	"reversed_adjustment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_adjustments_reason_not_empty" CHECK (length(trim("enrollment_expiration_adjustments"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "enrollment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "enrollment_event_type" NOT NULL,
	"user_id" text,
	"course_id" uuid,
	"enrollment_id" uuid,
	"grant_id" uuid,
	"order_id" uuid,
	"actor_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_grants" ADD CONSTRAINT "enrollment_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_grants" ADD CONSTRAINT "enrollment_grants_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_grants" ADD CONSTRAINT "enrollment_grants_source_id_orders_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_expiration_adjustments" ADD CONSTRAINT "enrollment_expiration_adjustments_grant_id_enrollment_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."enrollment_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_expiration_adjustments" ADD CONSTRAINT "enrollment_expiration_adjustments_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_expiration_adjustments" ADD CONSTRAINT "enrollment_expiration_adjustments_reversed_adjustment_id_fk" FOREIGN KEY ("reversed_adjustment_id") REFERENCES "public"."enrollment_expiration_adjustments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_grant_id_enrollment_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."enrollment_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_events" ADD CONSTRAINT "enrollment_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_grants_source_unique_idx" ON "enrollment_grants" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "enrollment_grants_user_course_status_idx" ON "enrollment_grants" USING btree ("user_id","course_id","status");--> statement-breakpoint
CREATE INDEX "enrollment_grants_effective_expires_at_idx" ON "enrollment_grants" USING btree ("effective_expires_at");--> statement-breakpoint
CREATE INDEX "enrollment_adjustments_grant_created_idx" ON "enrollment_expiration_adjustments" USING btree ("grant_id","created_at");--> statement-breakpoint
CREATE INDEX "enrollment_events_user_course_created_idx" ON "enrollment_events" USING btree ("user_id","course_id","created_at");--> statement-breakpoint
CREATE INDEX "enrollment_events_grant_idx" ON "enrollment_events" USING btree ("grant_id");--> statement-breakpoint
INSERT INTO "enrollment_grants" (
	"user_id",
	"course_id",
	"source_type",
	"source_id",
	"status",
	"starts_at",
	"base_expires_at",
	"effective_expires_at"
)
SELECT
	o.user_id,
	o.course_id,
	'abacatepay_order',
	o.id,
	CASE
		WHEN o.status = 'refunded' THEN 'refunded'::enrollment_grant_status
		WHEN o.status = 'disputed' THEN 'disputed'::enrollment_grant_status
		WHEN o.status = 'cancelled' THEN 'cancelled'::enrollment_grant_status
		WHEN coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months)) < now() THEN 'expired'::enrollment_grant_status
		ELSE 'active'::enrollment_grant_status
	END,
	coalesce(o.paid_at, o.created_at),
	coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months)),
	coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months))
FROM "orders" o
JOIN "courses" c ON c.id = o.course_id
WHERE o.user_id IS NOT NULL
	AND o.status IN ('paid', 'refunded', 'disputed', 'cancelled')
ON CONFLICT ("source_type","source_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "enrollment_events" (
	"event_type",
	"user_id",
	"course_id",
	"enrollment_id",
	"metadata"
)
SELECT
	'projection_rebuilt',
	e.user_id,
	e.course_id,
	e.id,
	jsonb_build_object(
		'warning',
		'existing_enrollment_without_paid_abacatepay_order',
		'status',
		e.status
	)
FROM "enrollments" e
WHERE NOT EXISTS (
	SELECT 1
	FROM "orders" o
	WHERE o.user_id = e.user_id
		AND o.course_id = e.course_id
		AND o.provider = 'abacatepay'
		AND o.status = 'paid'
);
