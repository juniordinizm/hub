ALTER TABLE "enrollments" ADD COLUMN "revoked_reason_category" text;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "approved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "executed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD COLUMN "executed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reviews" ADD CONSTRAINT "payment_reviews_executed_by_user_id_users_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;