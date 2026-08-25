import type { PoolClient } from "pg";

type Environment = Readonly<Record<string, string | undefined>>;
type SupersedeMode = "dry-run" | "execute";

export interface ExpiryWarningSupersedeTarget {
  databaseUrl: string;
  environment: "production" | "staging";
  mode: SupersedeMode;
}

const CONFIRMATION = "SUPERSEDE_EXPIRY_WARNING_V1";
const TRAILING_DOT_PATTERN = /\.$/;

const requiredEnvironmentValue = (
  environment: Environment,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(TRAILING_DOT_PATTERN, "");

export const resolveExpiryWarningSupersedeTarget = ({
  argv,
  environment,
}: {
  argv: readonly string[];
  environment: Environment;
}): ExpiryWarningSupersedeTarget => {
  const environmentArgs = argv.filter((value) =>
    value.startsWith("--environment=")
  );
  const modeArgs = argv.filter(
    (value) => value === "--dry-run" || value === "--execute"
  );
  if (
    environmentArgs.length !== 1 ||
    modeArgs.length !== 1 ||
    argv.length !== 2
  ) {
    throw new Error(
      "Use exactly --environment=staging|production and --dry-run|--execute."
    );
  }
  const targetEnvironment = environmentArgs[0]?.slice("--environment=".length);
  if (targetEnvironment !== "staging" && targetEnvironment !== "production") {
    throw new Error("Supersede environment must be staging or production.");
  }
  const mode: SupersedeMode =
    modeArgs[0] === "--execute" ? "execute" : "dry-run";
  if (
    mode === "execute" &&
    environment.EXPIRY_WARNING_V1_CONFIRMATION !== CONFIRMATION
  ) {
    throw new Error(
      `EXPIRY_WARNING_V1_CONFIRMATION must equal ${CONFIRMATION}.`
    );
  }
  const databaseUrl = requiredEnvironmentValue(
    environment,
    "DATABASE_URL_DIRECT"
  );
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL_DIRECT is invalid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    parsedUrl.searchParams.get("sslmode") !== "verify-full" ||
    normalizeHost(parsedUrl.hostname).includes("-pooler")
  ) {
    throw new Error(
      "DATABASE_URL_DIRECT must be a verified direct PostgreSQL URL."
    );
  }
  const hostVariable =
    targetEnvironment === "production"
      ? "PRODUCTION_DATABASE_HOST"
      : "STAGING_DATABASE_HOST";
  if (
    normalizeHost(parsedUrl.hostname) !==
    normalizeHost(requiredEnvironmentValue(environment, hostVariable))
  ) {
    throw new Error(
      "DATABASE_URL_DIRECT does not match the declared environment."
    );
  }
  return { databaseUrl, environment: targetEnvironment, mode };
};

const rollbackQuietly = async (
  client: Pick<PoolClient, "query">
): Promise<void> => {
  try {
    await client.query("rollback");
  } catch {
    // The caller receives the original sanitized failure.
  }
};

export const runExpiryWarningV1Supersede = async ({
  client,
  mode,
}: {
  client: Pick<PoolClient, "query">;
  mode: SupersedeMode;
}): Promise<{
  eligible: number;
  markersCleared: number;
  superseded: number;
}> => {
  let transactionOpen = false;
  try {
    await client.query(
      mode === "dry-run"
        ? "begin isolation level repeatable read read only"
        : "begin isolation level serializable"
    );
    transactionOpen = true;
    await client.query("set local statement_timeout = '5min'");
    await client.query("set local lock_timeout = '10s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('expiry-warning-v1-supersede', 0))"
    );
    const migration = await client.query<{ migration_ready: boolean }>(`
      select (
        exists (
          select 1
          from pg_enum value
          join pg_type type on type.oid = value.enumtypid
          where type.typname = 'outbox_status'
            and value.enumlabel = 'superseded'
        ) and exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'outbox_messages'
            and column_name = 'superseded_at'
        )
      ) as migration_ready
    `);
    if (!migration.rows[0]?.migration_ready) {
      throw new Error("Migration 0066 is not applied to the target.");
    }
    const counts = await client.query<{
      eligible_count: number;
      processing_count: number;
    }>(`
      select
        count(*) filter (where status in ('pending', 'retrying'))::int as eligible_count,
        count(*) filter (where status = 'processing')::int as processing_count
      from outbox_messages
      where topic = 'email.access-expiry-warning'
        and payload_version = 1
    `);
    const eligible = counts.rows[0]?.eligible_count ?? 0;
    if ((counts.rows[0]?.processing_count ?? 0) > 0) {
      throw new Error("A v1 expiry warning is still processing.");
    }
    if (mode === "dry-run") {
      await client.query("rollback");
      transactionOpen = false;
      return { eligible, markersCleared: 0, superseded: 0 };
    }

    const transitioned = await client.query<{
      markers_cleared: number;
      superseded_count: number;
    }>(`
      with candidates as (
        select
          id,
          aggregate_id,
          payload ->> 'warningKind' as warning_kind
        from outbox_messages
        where topic = 'email.access-expiry-warning'
          and payload_version = 1
          and status in ('pending', 'retrying')
        for update
      ), transitioned as (
        update outbox_messages as message
        set status = 'superseded',
            superseded_at = now(),
            delivered_at = null,
            locked_at = null,
            locked_by = null,
            last_error_code = 'expiry_payload_v1',
            last_error_at = now(),
            updated_at = now()
        from candidates as candidate
        where message.id = candidate.id
        returning candidate.aggregate_id, candidate.warning_kind
      ), cleared as (
        update enrollments as enrollment
        set expiry_warning_7d_sent_at = case
              when candidate.warning_kind = '7d' then null
              else enrollment.expiry_warning_7d_sent_at
            end,
            expiry_warning_1d_sent_at = case
              when candidate.warning_kind = '1d' then null
              else enrollment.expiry_warning_1d_sent_at
            end,
            updated_at = now()
        from (
          select distinct aggregate_id, warning_kind
          from transitioned
          where warning_kind in ('1d', '7d')
        ) as candidate
        where enrollment.id::text = candidate.aggregate_id
          and enrollment.status = 'active'
        returning enrollment.id
      )
      select
        (select count(*)::int from transitioned) as superseded_count,
        (select count(*)::int from cleared) as markers_cleared
    `);
    const result = transitioned.rows[0];
    if ((result?.superseded_count ?? 0) !== eligible) {
      throw new Error(
        "Expiry warning v1 candidate count changed during execution."
      );
    }
    await client.query("commit");
    transactionOpen = false;
    return {
      eligible,
      markersCleared: result?.markers_cleared ?? 0,
      superseded: result?.superseded_count ?? 0,
    };
  } catch (error) {
    if (transactionOpen) {
      await rollbackQuietly(client);
    }
    throw error;
  }
};
