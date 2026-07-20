import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const environmentArgument = process.argv.find((argument) =>
  argument.startsWith("--environment=")
);
const environment = environmentArgument?.slice("--environment=".length);
const rawDatabaseUrl = process.env.DATABASE_URL_DIRECT;

if (!rawDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_DIRECT e obrigatoria para a auditoria de migrations."
  );
}

if (!environment) {
  throw new Error("Informe o ambiente: --environment=<nome-sem-segredo>.");
}

interface MigrationCheck {
  check: string;
  details?: string;
  migration: string;
  state: "absent" | "inconclusive" | "present";
}

const runExistsCheck = async (
  client: PoolClient,
  migration: string,
  check: string,
  statement: string,
  values: string[] = []
): Promise<MigrationCheck> => {
  const result = await client.query<{ present: boolean }>(statement, values);

  return {
    check,
    migration,
    state: result.rows[0]?.present ? "present" : "absent",
  };
};

const inspectState = async (client: PoolClient): Promise<MigrationCheck[]> => {
  const checks: MigrationCheck[] = [];
  let scheduledQuery = Promise.resolve();
  const scheduleExistsCheck = (
    migration: string,
    check: string,
    statement: string
  ): Promise<MigrationCheck> => {
    const nextCheck = scheduledQuery.then(() =>
      runExistsCheck(client, migration, check, statement)
    );

    scheduledQuery = nextCheck.then(() => undefined);
    return nextCheck;
  };
  const objectChecks = [
    scheduleExistsCheck(
      "0024_enrollment_grants",
      "tabelas de concessao",
      "select to_regclass('public.enrollment_grants') is not null and to_regclass('public.enrollment_expiration_adjustments') is not null and to_regclass('public.enrollment_events') is not null as present"
    ),
    scheduleExistsCheck(
      "0024_enrollment_grants",
      "tipos de concessao",
      "select to_regtype('public.enrollment_grant_status') is not null and to_regtype('public.enrollment_grant_source_type') is not null and to_regtype('public.enrollment_adjustment_type') is not null and to_regtype('public.enrollment_event_type') is not null as present"
    ),
    scheduleExistsCheck(
      "0024_enrollment_grants",
      "indices de concessao",
      "select to_regclass('public.enrollment_grants_source_unique_idx') is not null and to_regclass('public.enrollment_grants_user_course_status_idx') is not null and to_regclass('public.enrollment_grants_effective_expires_at_idx') is not null as present"
    ),
    scheduleExistsCheck(
      "0025_manual_access_block_events",
      "eventos manuais de bloqueio",
      "select exists (select 1 from pg_enum enum join pg_type type on type.oid = enum.enumtypid where type.typname = 'enrollment_event_type' and enum.enumlabel in ('access_manually_blocked', 'access_manual_block_removed') having count(*) = 2) as present"
    ),
    scheduleExistsCheck(
      "0026_student_platform_block",
      "colunas de bloqueio da plataforma",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('platform_blocked_at', 'platform_blocked_reason') having count(*) = 2) as present"
    ),
    scheduleExistsCheck(
      "0027_case_insensitive_user_email",
      "indice de e-mail sem distincao de caixa",
      "select to_regclass('public.users_email_lower_unique_idx') is not null as present"
    ),
    scheduleExistsCheck(
      "0028_billing_operations_privacy",
      "tabelas de operacao financeira e privacidade",
      "select to_regclass('public.payment_reviews') is not null and to_regclass('public.refund_requests') is not null and to_regclass('public.privacy_requests') is not null and to_regclass('public.public_certificate_rate_limits') is not null as present"
    ),
    scheduleExistsCheck(
      "0028_billing_operations_privacy",
      "status de certificado",
      "select to_regtype('public.certificate_status') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name in ('status', 'revoked_at', 'revoked_reason', 'revoked_by_user_id', 'replaces_certificate_id') having count(*) = 5) as present"
    ),
    scheduleExistsCheck(
      "0029_dashboard_banner_blur_data_url",
      "coluna blur_data_url",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dashboard_banners' and column_name = 'blur_data_url') as present"
    ),
  ];

  for (const check of objectChecks) {
    checks.push(await check);
  }

  const durationDrift = await client.query<{ count: string }>(
    "select count(*) from lessons where text_duration_seconds <> case when text_word_count > 0 then greatest(1, round(text_word_count::numeric / 260 * 60))::integer else 0 end or duration_seconds <> video_duration_seconds + case when text_word_count > 0 then greatest(1, round(text_word_count::numeric / 260 * 60))::integer else 0 end"
  );
  const workloadDrift = await client.query<{ count: string }>(
    "select count(*) from courses left join (select modules.course_id, coalesce(ceil(sum(lessons.duration_seconds)::numeric / 3600), 0)::integer as workload_hours from modules left join lessons on lessons.module_id = modules.id group by modules.course_id) as derived_workloads on derived_workloads.course_id = courses.id where courses.workload_hours <> coalesce(derived_workloads.workload_hours, 0)"
  );
  const durationDriftCount = Number(durationDrift.rows[0]?.count ?? "0");
  const workloadDriftCount = Number(workloadDrift.rows[0]?.count ?? "0");

  checks.push({
    check: "dados recalculados de duracao e carga horaria",
    details: `${durationDriftCount} aulas e ${workloadDriftCount} cursos divergentes; consistencia nao prova que o SQL foi aplicado.`,
    migration: "0023_precise_text_reading_duration",
    state: "inconclusive",
  });

  const migrationTable = await client.query<{
    created_at: string;
    hash: string;
  }>(
    "select hash, created_at from drizzle.__drizzle_migrations order by created_at"
  );

  for (const row of migrationTable.rows) {
    checks.push({
      check: `registro Drizzle ${row.created_at}`,
      migration: row.hash,
      state: "present",
    });
  }

  return checks;
};

const pool = new Pool({
  connectionString: withVerifiedSslMode(rawDatabaseUrl),
});

const main = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '15s'");
    const checks = await inspectState(client);
    await client.query("rollback");

    console.log(
      JSON.stringify(
        {
          environment,
          generatedAt: new Date().toISOString(),
          checks,
          note: "Auditoria somente-leitura; hash do Drizzle nao e nome de migration.",
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
};

await main();
