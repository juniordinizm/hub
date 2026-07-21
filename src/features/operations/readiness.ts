interface ReadinessClient {
  query: (statement: string, values?: readonly unknown[]) => Promise<unknown>;
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
    await client.query("select 1 from drizzle.__drizzle_migrations limit 1");
    await client.query("rollback");
    return { ready: true };
  } catch {
    await client?.query("rollback").catch(() => undefined);
    return { ready: false };
  } finally {
    client?.release();
  }
};
