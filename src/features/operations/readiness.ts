import { LATEST_COMPATIBLE_MIGRATION_TIMESTAMP } from "@/db/migration-state";

interface ReadinessClient {
  query: (
    statement: string,
    values?: readonly unknown[]
  ) => Promise<{ rows?: unknown[] } | undefined>;
  release: () => void;
}

const READINESS_TIMEOUT_MS = 1000;

export const checkDatabaseReadiness = async ({
  connect,
}: {
  connect: () => Promise<ReadinessClient>;
}): Promise<{ ready: boolean }> => {
  let client: ReadinessClient | null = null;

  try {
    client = await connect();
    await client.query("begin read only");
    await client.query("select set_config('statement_timeout', $1, true)", [
      `${READINESS_TIMEOUT_MS}ms`,
    ]);
    const migrationResult = await client.query(
      "select 1 from drizzle.__drizzle_migrations where created_at = $1 limit 1",
      [LATEST_COMPATIBLE_MIGRATION_TIMESTAMP]
    );
    if (!migrationResult?.rows?.length) {
      throw new Error("Compatible database migration is not applied.");
    }
    await client.query("rollback");
    return { ready: true };
  } catch {
    await client?.query("rollback").catch(() => undefined);
    return { ready: false };
  } finally {
    client?.release();
  }
};
