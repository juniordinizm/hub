alter table enrollment_grants rename column source_id to order_id;
--> statement-breakpoint
alter table enrollment_grants alter column order_id drop not null;
--> statement-breakpoint
alter table enrollment_grants add column manual_reference text;
--> statement-breakpoint
drop index if exists enrollment_grants_source_unique_idx;
--> statement-breakpoint
create unique index enrollment_grants_order_unique_idx on enrollment_grants (order_id);
--> statement-breakpoint
create unique index enrollment_grants_manual_reference_unique_idx on enrollment_grants (manual_reference);
--> statement-breakpoint
alter table enrollment_grants add constraint enrollment_grants_source_shape_check check (
  (source_type::text = 'abacatepay_order' and order_id is not null and manual_reference is null)
  or (source_type::text = 'manual' and order_id is null and manual_reference is not null)
);
