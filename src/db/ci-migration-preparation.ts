import { isProductionNeonHost } from "./migration-target";

type Environment = Readonly<Record<string, string | undefined>>;

interface QueryResult<Row> {
  rows: Row[];
}

export interface CiMigrationPreparationClient {
  query: <Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string
  ) => Promise<QueryResult<Row>>;
}

const LEGACY_JOURNAL_COUNT = 44;
const LEGACY_JOURNAL_TOP = "1785037403006";
const CURRENT_JOURNALS = [
  { count: 53, top: "1785424607559" },
  { count: 54, top: "1785632318824" },
] as const;
const NEON_BRANCH_ID_PATTERN = /^br-[a-z0-9-]+$/;
const NEON_HOST_SUFFIX = ".neon.tech";
const PREPARATION_ADVISORY_LOCK_ID = "7032029002";

const parsePostgresUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

export const assertSafeCiMigrationPreparationEnvironment = (
  environment: Environment
): void => {
  if (environment.CI?.trim() !== "true") {
    throw new Error("CI must equal true.");
  }

  const branchId = environment.CI_NEON_BRANCH_ID?.trim();
  if (!(branchId && NEON_BRANCH_ID_PATTERN.test(branchId))) {
    throw new Error("CI_NEON_BRANCH_ID is required.");
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  const directDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();
  if (!(databaseUrl && directDatabaseUrl)) {
    throw new Error("DATABASE_URL and DATABASE_URL_DIRECT are required.");
  }
  if (databaseUrl !== directDatabaseUrl) {
    throw new Error("DATABASE_URL must exactly match DATABASE_URL_DIRECT.");
  }

  const parsedUrl = parsePostgresUrl(directDatabaseUrl);
  if (!parsedUrl?.hostname.endsWith(NEON_HOST_SUFFIX)) {
    throw new Error("DATABASE_URL_DIRECT must be a valid Neon PostgreSQL URL.");
  }
  if (isProductionNeonHost(parsedUrl.hostname)) {
    throw new Error(
      "CI migration preparation must not target the Production Neon compute."
    );
  }
};

export const prepareCiMigrationDatabase = async (
  client: CiMigrationPreparationClient
): Promise<{ status: "not-needed" | "prepared" }> => {
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    await client.query(
      `select pg_advisory_xact_lock(${PREPARATION_ADVISORY_LOCK_ID})`
    );
    const journal = await client.query<{
      migration_count: number;
      migration_top: string | null;
    }>(`
      select
        count(*)::int as migration_count,
        max(created_at)::text as migration_top
      from drizzle.__drizzle_migrations
    `);
    const state = journal.rows[0];
    const isLegacyJournal =
      state?.migration_count === LEGACY_JOURNAL_COUNT &&
      state.migration_top === LEGACY_JOURNAL_TOP;
    const isCurrentJournal = CURRENT_JOURNALS.some(
      ({ count, top }) =>
        state?.migration_count === count && state.migration_top === top
    );
    if (isCurrentJournal) {
      await client.query("commit");
      transactionOpen = false;
      return { status: "not-needed" };
    }
    if (!isLegacyJournal) {
      throw new Error(
        "CI migration preparation requires journal 0043, 0052, or 0053."
      );
    }

    await client.query("truncate table public.orders cascade");
    await client.query("commit");
    transactionOpen = false;
    return { status: "prepared" };
  } catch (error) {
    if (transactionOpen) {
      await client.query("rollback");
    }
    throw error;
  }
};
