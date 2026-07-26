import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";

type ScheduledJobLeaseResult<Value> =
  | { acquired: false }
  | { acquired: true; value: Value };

export interface ScheduledJobExecutionContext {
  deadlineAt: number;
  isLeaseOwner: () => Promise<boolean>;
  ownerToken: string;
}

export const runWithScheduledJobLease = async <Value>({
  deadlineMs,
  execute,
  jobName,
  leaseMs,
  ownerToken = randomUUID(),
}: {
  deadlineMs: number;
  execute: (context: ScheduledJobExecutionContext) => Promise<Value>;
  jobName: string;
  leaseMs: number;
  ownerToken?: string;
}): Promise<ScheduledJobLeaseResult<Value>> => {
  const pool = getPool();
  const acquired = await pool.query<{ owner_token: string }>(
    `
      insert into scheduled_job_leases (
        job_name,
        owner_token,
        locked_until
      )
      values ($1, $2::uuid, now() + ($3 * interval '1 millisecond'))
      on conflict (job_name) do update
      set owner_token = excluded.owner_token,
          locked_until = excluded.locked_until,
          updated_at = now()
      where scheduled_job_leases.locked_until <= now()
      returning owner_token
    `,
    [jobName, ownerToken, leaseMs]
  );

  if (!acquired.rows[0]) {
    return { acquired: false };
  }

  const context: ScheduledJobExecutionContext = {
    deadlineAt: Date.now() + deadlineMs,
    isLeaseOwner: async () => {
      const current = await pool.query(
        `
          select 1
          from scheduled_job_leases
          where job_name = $1
            and owner_token = $2::uuid
            and locked_until > now()
          limit 1
        `,
        [jobName, ownerToken]
      );
      return Boolean(current.rows[0]);
    },
    ownerToken,
  };
  try {
    return { acquired: true, value: await execute(context) };
  } finally {
    await pool.query(
      `
        delete from scheduled_job_leases
        where job_name = $1 and owner_token = $2::uuid
      `,
      [jobName, ownerToken]
    );
  }
};
