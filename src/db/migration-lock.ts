interface MigrationLockClient {
  query: (
    statement: string,
    values?: unknown[]
  ) => Promise<{ rows?: Array<{ acquired?: boolean }> } | undefined>;
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
    const lockResult = await client.query(
      "select pg_try_advisory_lock($1) as acquired",
      [PRODUCTION_MIGRATION_LOCK_ID]
    );
    if (lockResult?.rows?.[0]?.acquired !== true) {
      throw new Error("Another database migration is already running.");
    }

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
