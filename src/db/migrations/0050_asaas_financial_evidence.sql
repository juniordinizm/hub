ALTER TABLE "orders" ADD COLUMN "net_amount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fee_amount_in_cents" integer;
