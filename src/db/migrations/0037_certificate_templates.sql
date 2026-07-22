-- Custom SQL migration file, put your code below! --
create type "certificate_render_status" as enum ('pending', 'ready', 'failed');
create type "certificate_template_status" as enum ('draft', 'published', 'superseded');
alter table "courses" add column "certificate_enabled" boolean default false not null;
alter table "certificates" drop column if exists "pdf_url";
alter table "certificates" add column "pdf_storage_key" text;
alter table "certificates" add column "pdf_sha256" text;
alter table "certificates" add column "rendered_at" timestamp with time zone;
alter table "certificates" add column "render_status" "certificate_render_status" default 'pending' not null;
alter table "certificates" add column "render_snapshot" jsonb;
alter table "certificates" add column "certificate_template_id" uuid;
create table "certificate_issuer_profiles" ("id" text primary key, "legal_name" text not null, "cnpj" text not null, "display_name" text not null, "course_free_statement" text not null, "created_at" timestamp with time zone default now() not null, "updated_at" timestamp with time zone default now() not null);
create table "certificate_templates" ("id" uuid primary key default gen_random_uuid(), "course_id" uuid not null references "courses"("id") on delete cascade, "version" integer not null, "status" "certificate_template_status" default 'draft' not null, "background_key" text not null, "spec" jsonb not null, "signer_name" text, "signer_role" text, "signature_key" text, "published_at" timestamp with time zone, "created_at" timestamp with time zone default now() not null, "updated_at" timestamp with time zone default now() not null);
create unique index "certificate_templates_course_version_unique_idx" on "certificate_templates" ("course_id", "version");
create unique index "certificate_templates_one_published_per_course_idx" on "certificate_templates" ("course_id") where "status" = 'published';
create unique index "certificate_templates_one_draft_per_course_idx" on "certificate_templates" ("course_id") where "status" = 'draft';
alter table "certificates" add constraint "certificates_certificate_template_id_fk" foreign key ("certificate_template_id") references "certificate_templates"("id") on delete set null;
