import "server-only";
import { getPool } from "@/db";
import {
  getEnrollmentExpiryWarningKind,
  shouldExpireEnrollment,
} from "@/features/enrollments/rules";
import { createEnrollmentExpiryWarningMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";

interface EnrollmentMaintenanceResult {
  expiredCount: number;
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

export const processEnrollmentMaintenance = async ({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<EnrollmentMaintenanceResult> => {
  const pool = getPool();
  await pool.query(
    `
      update enrollment_grants
      set status = 'expired',
          updated_at = now()
      where status = 'active'
        and effective_expires_at < $1
    `,
    [now]
  );
  const expired = await pool.query(
    `
      update enrollments
      set status = 'expired',
          updated_at = now()
      where status = 'active'
        and expires_at < $1
    `,
    [now]
  );
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
      order by e.expires_at asc
    `,
    [now]
  );
  let warning7dCount = 0;
  let warning1dCount = 0;
  let warningFailureCount = 0;

  for (const enrollment of expiringEnrollments.rows) {
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
              ($2 = '7d' and expiry_warning_7d_sent_at is null)
              or ($2 = '1d' and expiry_warning_1d_sent_at is null)
            )
          returning id
        `,
        [enrollment.id, warningKind]
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
    expiredCount: expired.rowCount ?? 0,
    warning1dCount,
    warning7dCount,
    warningFailureCount,
  };
};
