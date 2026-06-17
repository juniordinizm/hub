ALTER TABLE "courses" ADD COLUMN "price_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_price_in_cents_non_negative" CHECK ("courses"."price_in_cents" >= 0);
