CREATE UNIQUE INDEX "payment_reviews_webhook_event_unique_idx" ON "payment_reviews" USING btree ("webhook_event_id") WHERE "payment_reviews"."webhook_event_id" is not null;
