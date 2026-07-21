CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'retrying', 'delivered', 'dead_letter');--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_version" integer NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error_code" text,
	"last_error_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_idempotency_key_unique_idx" ON "outbox_messages" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_messages_available_idx" ON "outbox_messages" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_messages_locked_idx" ON "outbox_messages" USING btree ("status","locked_at");