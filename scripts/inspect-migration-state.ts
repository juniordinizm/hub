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
      "0023_lyrical_lucky_pierre",
      "outbox de eventos",
      "select to_regclass('public.outbox_messages') is not null and to_regtype('public.outbox_status') is not null as present"
    ),
    scheduleExistsCheck(
      "0024_light_stature",
      "limite de reprocessamento manual da outbox",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'outbox_messages' and column_name = 'manual_reprocess_count') as present"
    ),
    scheduleExistsCheck(
      "0025_admin_certificate_privacy_workflows",
      "separacao de aprovacao e execucao financeira",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payment_reviews' and column_name in ('approved_by_user_id', 'approved_at', 'executed_by_user_id', 'executed_at') having count(*) = 4) as present"
    ),
    scheduleExistsCheck(
      "0026_certificate_privacy_segregation",
      "separacao de aprovacao e execucao de privacidade",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'privacy_requests' and column_name in ('approved_by_user_id', 'approved_at', 'executed_by_user_id', 'executed_at') having count(*) = 4) as present"
    ),
    scheduleExistsCheck(
      "0026_certificate_privacy_segregation",
      "categoria de revogacao de certificado",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'certificates' and column_name = 'revoked_reason_category') as present"
    ),
    scheduleExistsCheck(
      "0027_military_the_phantom",
      "remocao do artefato transitÃ³rio de matricula",
      "select not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'revoked_reason_category') as present"
    ),
    scheduleExistsCheck(
      "0028_quick_squadron_supreme",
      "estrutura de versoes de curso",
      "select to_regclass('public.course_versions') is not null and to_regtype('public.course_version_status') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('modules', 'lessons', 'enrollments', 'certificates') and column_name = 'course_version_id' having count(*) = 4) as present"
    ),
    scheduleExistsCheck(
      "0029_lush_goblin_queen",
      "backfill das referencias de versao",
      "select not exists (select 1 from modules where course_version_id is null union all select 1 from lessons where course_version_id is null union all select 1 from enrollments where course_version_id is null union all select 1 from certificates where course_version_id is null) as present"
    ),
    scheduleExistsCheck(
      "0030_complete_epoch",
      "restricoes e indices por versao",
      "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('modules', 'lessons', 'enrollments', 'certificates') and column_name = 'course_version_id' and is_nullable = 'NO' having count(*) = 4) and to_regclass('public.modules_course_version_sort_unique_idx') is not null and to_regclass('public.certificates_user_course_version_active_unique_idx') is not null as present"
    ),
  ];

  for (const check of objectChecks) {
    checks.push(await check);
  }

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
