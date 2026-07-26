import "server-only";
import { getPool } from "@/db";
import {
  getEnrollmentExpiryWarningKind,
  shouldExpireEnrollment,
} from "@/features/enrollments/rules";
import { createEnrollmentExpiryWarningMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";

interface EnrollmentMaintenanceResult {
  deadlineReached: boolean;
  expiredCount: number;
  leaseLost: boolean;
  warning1dCount: number;
  warning7dCount: number;
  warningFailureCount: number;
}

interface ExpiringEnrollmentRow {
  expires_at: Date;
  expiry_warning_1d_sent_at: Date | null;
  expiry_warning_7d_sent_at: Date | null;
  id: string;
  status: "active" | "expired" | "revoked";
}

type MaintenanceStopReason = "deadline" | "lease";

const getMaintenanceStopReason = async ({
  clock,
  deadlineAt,
  isLeaseOwner,
}: {
  clock: () => number;
  deadlineAt: number;
  isLeaseOwner: () => Promise<boolean>;
}): Promise<MaintenanceStopReason | null> => {
  if (clock() >= deadlineAt) {
    return "deadline";
  }
  return (await isLeaseOwner()) ? null : "lease";
};

const createStoppedEnrollmentMaintenanceResult = (
  reason: MaintenanceStopReason
): EnrollmentMaintenanceResult => ({
  deadlineReached: reason === "deadline",
  expiredCount: 0,
  leaseLost: reason === "lease",
  warning1dCount: 0,
  warning7dCount: 0,
  warningFailureCount: 0,
});

const expireEnrollmentRecords = async ({
  clock,
  deadlineAt,
  isLeaseOwner,
  now,
  ownerToken,
}: {
  clock: () => number;
  deadlineAt: number;
  isLeaseOwner: () => Promise<boolean>;
  now: Date;
  ownerToken: string | null;
}): Promise<
  | { expiredCount: number; stopped?: never }
  | { expiredCount?: never; stopped: EnrollmentMaintenanceResult }
> => {
  const pool = getPool();
  const initialStopReason = await getMaintenanceStopReason({
    clock,
    deadlineAt,
    isLeaseOwner,
  });
  if (initialStopReason) {
    return {
      stopped: createStoppedEnrollmentMaintenanceResult(initialStopReason),
    };
  }
  await pool.query(
    `
      update enrollment_grants
      set status = 'expired',
          updated_at = now()
      where status = 'active'
        and effective_expires_at < $1
        and (
          $2::uuid is null
          or exists (
            select 1 from scheduled_job_leases
            where job_name = 'enrollments'
              and owner_token = $2::uuid
              and locked_until > now()
          )
        )
    `,
    [now, ownerToken]
  );
  const grantsStopReason = await getMaintenanceStopReason({
    clock,
    deadlineAt,
    isLeaseOwner,
  });
  if (grantsStopReason) {
    return {
      stopped: createStoppedEnrollmentMaintenanceResult(grantsStopReason),
    };
  }
  const expired = await pool.query(
    `
      update enrollments
      set status = 'expired',
          updated_at = now()
      where status = 'active'
        and expires_at < $1
        and (
          $2::uuid is null
          or exists (
            select 1 from scheduled_job_leases
            where job_name = 'enrollments'
              and owner_token = $2::uuid
              and locked_until > now()
          )
        )
    `,
    [now, ownerToken]
  );
  const enrollmentsStopReason = await getMaintenanceStopReason({
    clock,
    deadlineAt,
    isLeaseOwner,
  });
  if (enrollmentsStopReason) {
    return {
      stopped: {
        ...createStoppedEnrollmentMaintenanceResult(enrollmentsStopReason),
        expiredCount: expired.rowCount ?? 0,
      },
    };
  }
  return { expiredCount: expired.rowCount ?? 0 };
};

export const processEnrollmentMaintenance = async ({
  clock = Date.now,
  deadlineAt = Number.POSITIVE_INFINITY,
  isLeaseOwner = async () => true,
  now = new Date(),
  ownerToken = null,
}: {
  clock?: () => number;
  deadlineAt?: number;
  isLeaseOwner?: () => Promise<boolean>;
  now?: Date;
  ownerToken?: string | null;
} = {}): Promise<EnrollmentMaintenanceResult> => {
  const pool = getPool();
  const expiry = await expireEnrollmentRecords({
    clock,
    deadlineAt,
    isLeaseOwner,
    now,
    ownerToken,
  });
  if (expiry.stopped) {
    return expiry.stopped;
  }
  const expiringEnrollments = await pool.query<ExpiringEnrollmentRow>(
    `
      select
        e.id,
        e.status,
        e.expires_at,
        e.expiry_warning_7d_sent_at,
        e.expiry_warning_1d_sent_at
      from enrollments e
      where e.status = 'active'
        and e.expires_at >= $1
        and e.expires_at <= $1::timestamptz + interval '7 days'
        and (
          (
            e.expires_at <= $1::timestamptz + interval '1 day'
            and e.expiry_warning_1d_sent_at is null
          )
          or (
            e.expires_at > $1::timestamptz + interval '1 day'
            and e.expiry_warning_7d_sent_at is null
          )
        )
      order by e.expires_at asc
      limit 500
    `,
    [now]
  );
  let warning7dCount = 0;
  let warning1dCount = 0;
  let warningFailureCount = 0;
  let deadlineReached = false;
  let leaseLost = false;
  let processedSinceLeaseCheck = 20;

  for (const enrollment of expiringEnrollments.rows) {
    if (processedSinceLeaseCheck >= 20) {
      const stopReason = await getMaintenanceStopReason({
        clock,
        deadlineAt,
        isLeaseOwner,
      });
      if (stopReason) {
        deadlineReached = stopReason === "deadline";
        leaseLost = stopReason === "lease";
        break;
      }
      processedSinceLeaseCheck = 0;
    }
    processedSinceLeaseCheck += 1;
    if (
      shouldExpireEnrollment({
        expiresAt: enrollment.expires_at,
        now,
        status: enrollment.status,
      })
    ) {
      continue;
    }

    const warningKind = getEnrollmentExpiryWarningKind({
      expiresAt: enrollment.expires_at,
      now,
      warning1dSentAt: enrollment.expiry_warning_1d_sent_at,
      warning7dSentAt: enrollment.expiry_warning_7d_sent_at,
    });

    if (!warningKind) {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      const updated = await client.query<{ id: string }>(
        `
          update enrollments
          set expiry_warning_7d_sent_at =
                case when $2 = '7d' then now() else expiry_warning_7d_sent_at end,
              expiry_warning_1d_sent_at =
                case when $2 = '1d' then now() else expiry_warning_1d_sent_at end,
              updated_at = now()
          where id = $1
            and status = 'active'
            and (
              $3::uuid is null
              or exists (
                select 1 from scheduled_job_leases
                where job_name = 'enrollments'
                  and owner_token = $3::uuid
                  and locked_until > now()
              )
            )
            and (
              ($2 = '7d' and expiry_warning_7d_sent_at is null)
              or ($2 = '1d' and expiry_warning_1d_sent_at is null)
            )
          returning id
        `,
        [enrollment.id, warningKind, ownerToken]
      );

      if (!updated.rows[0]) {
        await client.query("rollback");
        continue;
      }

      await enqueueOutboxMessage({
        client,
        message: createEnrollmentExpiryWarningMessage({
          enrollmentId: enrollment.id,
          warningKind,
        }),
      });
      await client.query("commit");
    } catch {
      await client.query("rollback");
      warningFailureCount += 1;
      continue;
    } finally {
      client.release();
    }

    if (warningKind === "7d") {
      warning7dCount += 1;
    } else {
      warning1dCount += 1;
    }
  }

  return {
    deadlineReached,
    expiredCount: expiry.expiredCount,
    leaseLost,
    warning1dCount,
    warning7dCount,
    warningFailureCount,
  };
};
