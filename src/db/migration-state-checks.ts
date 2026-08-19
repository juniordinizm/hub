export interface MigrationStateCheck {
  check: string;
  migration: string;
  statement: string;
}

export const certificateMigrationStateChecks: readonly MigrationStateCheck[] = [
  {
    check: "templates e artefatos imutaveis de certificados",
    migration: "0037_certificate_templates",
    statement:
      "select to_regclass('public.certificate_issuer_profiles') is not null and to_regclass('public.certificate_templates') is not null and to_regtype('public.certificate_render_status') is not null and to_regtype('public.certificate_template_status') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'courses' and column_name = 'certificate_enabled') and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name in ('certificate_template_id', 'pdf_storage_key', 'pdf_sha256', 'rendered_at', 'render_status', 'render_snapshot') having count(*) = 6) and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name = 'pdf_url') and to_regclass('public.certificate_templates_one_published_per_course_idx') is not null as present",
  },
  {
    check: "claim persistido e invariantes do artefato de certificado",
    migration: "0040_certificate_render_claim",
    statement:
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name in ('render_claim_token', 'render_claimed_at') having count(*) = 2) and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_render_claim_pair_check' and contype = 'c') and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_ready_artifact_check' and contype = 'c') as present",
  },
  {
    check: "estado de revogacao e historico de certificados",
    migration: "0056_certificate_state_invariants",
    statement:
      "select exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname in ('certificates_revocation_state_check', 'certificates_revoked_reason_category_check', 'certificates_valid_revocation_fields_check') and contype = 'c' group by conrelid having count(*) = 3) and exists (select 1 from pg_constraint where conrelid = 'public.certificates'::regclass and conname = 'certificates_course_id_courses_id_fk' and confdeltype = 'r') as present",
  },
];
