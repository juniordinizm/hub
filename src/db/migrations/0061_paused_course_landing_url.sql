ALTER TABLE "courses" DROP CONSTRAINT "courses_launch_fields_only_for_coming_soon";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_launch_fields_only_for_coming_soon" CHECK ((
        "courses"."launch_date" is null and "courses"."launch_landing_url" is null
      ) or (
        "courses"."status" = 'draft'
        and "courses"."catalog_visibility" = 'listed'
        and "courses"."sales_status" = 'closed'
      ) or (
        "courses"."launch_date" is null
        and "courses"."status" = 'active'
        and "courses"."sales_status" = 'closed'
      ));