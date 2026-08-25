CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "two_factors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE FUNCTION revoke_sessions_after_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	DELETE FROM sessions WHERE user_id = NEW.user_id;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER profiles_revoke_sessions_after_role_change
AFTER UPDATE OF role ON profiles
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION revoke_sessions_after_profile_role_change();--> statement-breakpoint
CREATE FUNCTION revoke_sessions_after_two_factor_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	DELETE FROM sessions WHERE user_id = NEW.id;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER users_revoke_sessions_after_two_factor_change
AFTER UPDATE OF two_factor_enabled ON users
FOR EACH ROW
WHEN (OLD.two_factor_enabled IS DISTINCT FROM NEW.two_factor_enabled)
EXECUTE FUNCTION revoke_sessions_after_two_factor_change();
