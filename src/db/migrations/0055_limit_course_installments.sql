ALTER TABLE "courses" DROP CONSTRAINT "courses_payment_installment_count_valid";--> statement-breakpoint
UPDATE "courses" SET "payment_max_installment_count" = 12 WHERE "payment_max_installment_count" > 12;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_payment_installment_count_valid" CHECK ("courses"."payment_max_installment_count" between 1 and 12);
