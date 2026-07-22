ALTER TABLE "learning_analytics_consents" RENAME TO "learning_analytics_preferences";--> statement-breakpoint
ALTER TABLE "learning_analytics_preferences" RENAME COLUMN "consented_at" TO "enabled_at";--> statement-breakpoint
ALTER TABLE "learning_analytics_preferences" RENAME COLUMN "revoked_at" TO "disabled_at";--> statement-breakpoint
DROP TABLE "learning_reengagements" CASCADE;--> statement-breakpoint
DROP TYPE "learning_reengagement_status";
