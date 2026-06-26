ALTER TABLE "profiles" ADD COLUMN "platform_blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "platform_blocked_reason" text;--> statement-breakpoint
