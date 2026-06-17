ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_duration_months" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_access_duration_positive" CHECK ("orders"."access_duration_months" IS NULL OR "orders"."access_duration_months" > 0);
