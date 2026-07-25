interface AdvisoryLockClient {
  query: (
    statement: string,
    values?: unknown[]
  ) => Promise<{ rows: Array<{ acquired?: boolean }> }>;
  release: () => void;
}

type AdvisoryLockResult<Value> =
  | { acquired: false }
  | { acquired: true; value: Value };

export const runWithAdvisoryLock = async <Value>({
  connect,
  execute,
  lockId,
}: {
  connect: () => Promise<AdvisoryLockClient>;
  execute: () => Promise<Value>;
  lockId: number;
}): Promise<AdvisoryLockResult<Value>> => {
  const client = await connect();
  let acquired = false;

  try {
    const result = await client.query(
      "select pg_try_advisory_lock($1) as acquired",
      [lockId]
    );
    acquired = result.rows[0]?.acquired === true;

    if (!acquired) {
      return { acquired: false };
    }

    return { acquired: true, value: await execute() };
  } finally {
    try {
      if (acquired) {
        await client.query("select pg_advisory_unlock($1)", [lockId]);
      }
    } finally {
      client.release();
    }
  }
};
