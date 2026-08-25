CREATE TYPE "public"."email_delivery_topic" AS ENUM('auth.account-activation', 'auth.password-reset', 'email.access-released', 'email.access-expiry-warning', 'email.certificate-issued', 'email.course-sales-opened', 'email.support-request');--> statement-breakpoint
CREATE TYPE "public"."email_message_status" AS ENUM('sending', 'acceptance_unknown', 'accepted', 'delayed', 'delivered', 'failed', 'suppressed', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "public"."email_template_alias" AS ENUM('auth-password-reset', 'access-released', 'access-expiry-warning', 'certificate-issued', 'course-sales-opened', 'support-request');--> statement-breakpoint
CREATE TYPE "public"."resend_webhook_event_status" AS ENUM('received', 'processing', 'processed', 'ignored', 'retrying', 'dead_letter');--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'resend' NOT NULL,
	"provider_message_id" text,
	"outbox_message_id" uuid,
	"correlation_id" uuid NOT NULL,
	"topic" "email_delivery_topic" NOT NULL,
	"template_alias" "email_template_alias" NOT NULL,
	"status" "email_message_status" DEFAULT 'sending' NOT NULL,
	"request_fingerprint" text NOT NULL,
	"first_provider_attempt_at" timestamp with time zone,
	"acceptance_unknown_at" timestamp with time zone,
	"automatic_retry_deadline_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"latest_event_at" timestamp with time zone,
	"delayed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"suppressed_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"complained_at" timestamp with time zone,
	"last_error_code" text,
	"delivery_event_conflict" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_provider_message_id_unique" UNIQUE("provider_message_id"),
	CONSTRAINT "email_messages_outbox_message_id_unique" UNIQUE("outbox_message_id"),
	CONSTRAINT "email_messages_correlation_id_unique" UNIQUE("correlation_id"),
	CONSTRAINT "email_messages_provider_resend" CHECK ("email_messages"."provider" = 'resend'),
	CONSTRAINT "email_messages_request_fingerprint_sha256" CHECK ("email_messages"."request_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "resend_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_message_id" text,
	"correlation_id" uuid,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_sha256" text NOT NULL,
	"status" "resend_webhook_event_status" DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"processed_at" timestamp with time zone,
	"last_error_code" text,
	"email_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resend_webhook_events_provider_event_id_unique" UNIQUE("provider_event_id"),
	CONSTRAINT "resend_webhook_events_payload_sha256" CHECK ("resend_webhook_events"."payload_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_outbox_message_id_outbox_messages_id_fk" FOREIGN KEY ("outbox_message_id") REFERENCES "public"."outbox_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resend_webhook_events" ADD CONSTRAINT "resend_webhook_events_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_messages_status_updated_idx" ON "email_messages" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_available_idx" ON "resend_webhook_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_provider_message_idx" ON "resend_webhook_events" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_timeline_idx" ON "resend_webhook_events" USING btree ("email_message_id","occurred_at");--> statement-breakpoint
CREATE INDEX "resend_webhook_events_correlation_idx" ON "resend_webhook_events" USING btree ("correlation_id");