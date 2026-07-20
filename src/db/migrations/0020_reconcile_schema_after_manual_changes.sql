-- Reconciles branches whose Drizzle journal stopped at 0019 but received later
-- schema changes manually. Every statement is safe when the target object exists.

do $$ begin
  create type lesson_comment_status as enum ('visible', 'hidden');
exception when duplicate_object then null;
end $$;

create table if not exists lesson_comments (
  id uuid primary key default gen_random_uuid() not null,
  lesson_id uuid not null references lessons(id) on delete cascade,
  author_user_id text references users(id) on delete set null,
  parent_id uuid references lesson_comments(id) on delete cascade,
  body text not null,
  status lesson_comment_status default 'visible' not null,
  hidden_by_user_id text references users(id) on delete set null,
  hidden_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create index if not exists lesson_comments_lesson_created_idx on lesson_comments (lesson_id, created_at);
create index if not exists lesson_comments_parent_created_idx on lesson_comments (parent_id, created_at);
create index if not exists lesson_comments_author_idx on lesson_comments (author_user_id);

alter table lessons add column if not exists video_duration_seconds integer default 0 not null;
alter table lessons add column if not exists text_duration_seconds integer default 0 not null;
alter table lessons add column if not exists text_word_count integer default 0 not null;
update lessons
set video_duration_seconds = greatest(0, duration_seconds),
    text_duration_seconds = 0,
    text_word_count = 0
where video_duration_seconds = 0
  and text_duration_seconds = 0
  and text_word_count = 0
  and duration_seconds > 0;
update lessons set duration_seconds = video_duration_seconds + text_duration_seconds;
do $$ begin
  alter table lessons add constraint lessons_video_duration_seconds_non_negative check (video_duration_seconds >= 0);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table lessons add constraint lessons_text_duration_seconds_non_negative check (text_duration_seconds >= 0);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table lessons add constraint lessons_text_word_count_non_negative check (text_word_count >= 0);
exception when duplicate_object then null;
end $$;

alter table modules add column if not exists status course_status default 'draft' not null;
update modules set status = 'active' where status = 'draft';
alter table lessons add column if not exists status course_status default 'draft' not null;
update lessons set status = case when is_published then 'active'::course_status else 'draft'::course_status end;
alter table faq_items drop column if exists category;

with recalculated_lessons as (
  select id, case when text_word_count > 0 then greatest(1, round(text_word_count::numeric / 260 * 60))::integer else 0 end as text_duration_seconds
  from lessons
)
update lessons
set text_duration_seconds = recalculated_lessons.text_duration_seconds,
    duration_seconds = video_duration_seconds + recalculated_lessons.text_duration_seconds,
    updated_at = now()
from recalculated_lessons
where lessons.id = recalculated_lessons.id
  and lessons.text_duration_seconds <> recalculated_lessons.text_duration_seconds;
update courses
set workload_hours = derived.workload_hours,
    updated_at = now()
from (
  select courses.id as course_id, coalesce(ceil(sum(lessons.duration_seconds)::numeric / 3600), 0)::integer as workload_hours
  from courses left join modules on modules.course_id = courses.id left join lessons on lessons.module_id = modules.id
  group by courses.id
) as derived
where courses.id = derived.course_id;

create table if not exists dashboard_banners (
  id uuid primary key default gen_random_uuid() not null,
  title text,
  image_url text not null,
  link_url text,
  button_text text,
  is_active boolean default true not null,
  sort_order integer not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  blur_data_url text
);
alter table dashboard_banners add column if not exists blur_data_url text;

do $$ begin create type enrollment_grant_status as enum ('active', 'expired', 'refunded', 'disputed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type enrollment_grant_source_type as enum ('abacatepay_order'); exception when duplicate_object then null; end $$;
do $$ begin create type enrollment_adjustment_type as enum ('extend_days', 'extend_months', 'set_exact_expiration', 'reversal'); exception when duplicate_object then null; end $$;
do $$ begin create type enrollment_event_type as enum ('payment_paid', 'payment_refunded', 'payment_disputed', 'expiration_extended', 'expiration_set', 'expiration_adjustment_reversed', 'projection_rebuilt'); exception when duplicate_object then null; end $$;
create table if not exists enrollment_grants (
  id uuid primary key default gen_random_uuid() not null,
  user_id text not null references users(id),
  course_id uuid not null references courses(id) on delete cascade,
  source_type enrollment_grant_source_type not null,
  source_id uuid not null references orders(id) on delete cascade,
  status enrollment_grant_status default 'active' not null,
  starts_at timestamp with time zone not null,
  base_expires_at timestamp with time zone not null,
  effective_expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone,
  revoked_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint enrollment_grants_effective_after_start check (effective_expires_at > starts_at)
);
create table if not exists enrollment_expiration_adjustments (
  id uuid primary key default gen_random_uuid() not null,
  grant_id uuid not null references enrollment_grants(id) on delete cascade,
  adjustment_type enrollment_adjustment_type not null,
  delta_days integer,
  delta_months integer,
  previous_expires_at timestamp with time zone not null,
  new_expires_at timestamp with time zone not null,
  reason text not null,
  actor_user_id text references users(id) on delete set null,
  reversed_adjustment_id uuid references enrollment_expiration_adjustments(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint enrollment_adjustments_reason_not_empty check (length(trim(reason)) > 0)
);
create table if not exists enrollment_events (
  id uuid primary key default gen_random_uuid() not null,
  event_type enrollment_event_type not null,
  user_id text references users(id) on delete set null,
  course_id uuid references courses(id) on delete cascade,
  enrollment_id uuid references enrollments(id) on delete set null,
  grant_id uuid references enrollment_grants(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  actor_user_id text references users(id) on delete set null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
create unique index if not exists enrollment_grants_source_unique_idx on enrollment_grants (source_type, source_id);
create index if not exists enrollment_grants_user_course_status_idx on enrollment_grants (user_id, course_id, status);
create index if not exists enrollment_grants_effective_expires_at_idx on enrollment_grants (effective_expires_at);
create index if not exists enrollment_adjustments_grant_created_idx on enrollment_expiration_adjustments (grant_id, created_at);
create index if not exists enrollment_events_user_course_created_idx on enrollment_events (user_id, course_id, created_at);
create index if not exists enrollment_events_grant_idx on enrollment_events (grant_id);
insert into enrollment_grants (user_id, course_id, source_type, source_id, status, starts_at, base_expires_at, effective_expires_at)
select o.user_id, o.course_id, 'abacatepay_order', o.id,
  case when o.status = 'refunded' then 'refunded'::enrollment_grant_status when o.status = 'disputed' then 'disputed'::enrollment_grant_status when o.status = 'cancelled' then 'cancelled'::enrollment_grant_status when coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months)) < now() then 'expired'::enrollment_grant_status else 'active'::enrollment_grant_status end,
  coalesce(o.paid_at, o.created_at), coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months)), coalesce(o.paid_at, o.created_at) + make_interval(months => coalesce(o.access_duration_months, c.access_duration_months))
from orders o join courses c on c.id = o.course_id
where o.user_id is not null and o.status in ('paid', 'refunded', 'disputed', 'cancelled')
on conflict (source_type, source_id) do nothing;
insert into enrollment_events (event_type, user_id, course_id, enrollment_id, metadata)
select 'projection_rebuilt', e.user_id, e.course_id, e.id, jsonb_build_object('warning', 'existing_enrollment_without_paid_abacatepay_order', 'status', e.status)
from enrollments e
where not exists (select 1 from orders o where o.user_id = e.user_id and o.course_id = e.course_id and o.provider = 'abacatepay' and o.status = 'paid')
  and not exists (select 1 from enrollment_events event where event.enrollment_id = e.id and event.event_type = 'projection_rebuilt' and event.metadata->>'warning' = 'existing_enrollment_without_paid_abacatepay_order');
alter type enrollment_event_type add value if not exists 'access_manually_blocked';
alter type enrollment_event_type add value if not exists 'access_manual_block_removed';
alter table profiles add column if not exists platform_blocked_at timestamp with time zone;
alter table profiles add column if not exists platform_blocked_reason text;
create unique index if not exists users_email_lower_unique_idx on users (lower(email));

do $$ begin create type payment_review_type as enum ('amount_mismatch', 'terminal_conflict'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_review_status as enum ('pending', 'approved', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type refund_request_status as enum ('requested', 'failed', 'confirmed'); exception when duplicate_object then null; end $$;
do $$ begin create type certificate_status as enum ('valid', 'revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type privacy_request_status as enum ('requested', 'approved', 'completed', 'rejected'); exception when duplicate_object then null; end $$;
create table if not exists payment_reviews (
  id uuid primary key default gen_random_uuid() not null, order_id uuid not null references orders(id) on delete cascade,
  webhook_event_id uuid references webhook_events(id) on delete set null, type payment_review_type not null,
  status payment_review_status default 'pending' not null, reason text not null, decision_reason text,
  resolved_by_user_id text references users(id) on delete set null, resolved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null
);
create table if not exists refund_requests (
  id uuid primary key default gen_random_uuid() not null, order_id uuid not null references orders(id) on delete cascade,
  requested_by_user_id text not null references users(id), reason text not null,
  status refund_request_status default 'requested' not null, provider_refund_id text, error_message text,
  confirmed_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null
);
create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid() not null, user_id text not null references users(id),
  requested_by_user_id text references users(id) on delete set null, status privacy_request_status default 'requested' not null,
  reason text not null, resolved_by_user_id text references users(id) on delete set null, resolved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null
);
create table if not exists public_certificate_rate_limits (
  key_hash text primary key not null, window_started_at timestamp with time zone default now() not null,
  request_count integer default 0 not null, expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null
);
alter table certificates add column if not exists status certificate_status default 'valid' not null;
alter table certificates add column if not exists revoked_at timestamp with time zone;
alter table certificates add column if not exists revoked_reason text;
alter table certificates add column if not exists revoked_by_user_id text;
alter table certificates add column if not exists replaces_certificate_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'certificates_revoked_by_user_id_users_id_fk') then
    alter table certificates add constraint certificates_revoked_by_user_id_users_id_fk foreign key (revoked_by_user_id) references users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'certificates_replaces_certificate_id_certificates_id_fk') then
    alter table certificates add constraint certificates_replaces_certificate_id_certificates_id_fk foreign key (replaces_certificate_id) references certificates(id) on delete set null;
  end if;
end $$;
drop index if exists certificates_user_course_unique_idx;
create unique index if not exists certificates_user_course_active_unique_idx on certificates (user_id, course_id) where status = 'valid';
create index if not exists certificates_status_idx on certificates (status);
create index if not exists payment_reviews_order_status_idx on payment_reviews (order_id, status);
create index if not exists payment_reviews_status_idx on payment_reviews (status);
create unique index if not exists refund_requests_order_unique_idx on refund_requests (order_id);
create index if not exists refund_requests_status_idx on refund_requests (status);
create index if not exists privacy_requests_user_status_idx on privacy_requests (user_id, status);
create index if not exists public_certificate_rate_limits_expires_at_idx on public_certificate_rate_limits (expires_at);
