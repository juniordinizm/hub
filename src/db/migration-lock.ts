interface MigrationLockClient {
  query: (statement: string, values?: unknown[]) => Promise<unknown>;
  release: () => void;
}

const PRODUCTION_MIGRATION_LOCK_ID = 2_040_700;

export const runMigrationWithLock = async ({
  client,
  migrate,
}: {
  client: MigrationLockClient;
  migrate: () => Promise<void>;
}): Promise<void> => {
  let acquired = false;

  try {
    await client.query("select pg_advisory_lock($1)", [
      PRODUCTION_MIGRATION_LOCK_ID,
    ]);
    acquired = true;
    await migrate();
  } finally {
    try {
      if (acquired) {
        await client.query("select pg_advisory_unlock($1)", [
          PRODUCTION_MIGRATION_LOCK_ID,
        ]);
      }
    } finally {
      client.release();
    }
  }
};
