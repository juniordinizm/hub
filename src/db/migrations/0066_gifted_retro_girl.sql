ALTER TYPE "public"."outbox_status" ADD VALUE 'superseded';--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_messages_superseded_idx" ON "outbox_messages" USING btree ("superseded_at");
