import "server-only";
import { getPool } from "@/db";
import { sendAccessExpiryWarningEmail } from "@/features/email/server";
import {
  getEnrollmentExpiryWarningKind,
  shouldExpireEnrollment,
} from "@/features/enrollments/rules";

interface EnrollmentMaintenanceResult {
  expiredCount: number;
  warning1dCount: number;
  warning7dCount: number;
  warningFailureCount: number;
}

interface ExpiringEnrollmentRow {
  course_id: string;
  course_title: string;
  email: string;
  expires_at: Date;
  expiry_warning_1d_sent_at: Date | null;
  expiry_warning_7d_sent_at: Date | null;
  id: string;
  name: string;
  status: "active" | "expired" | "revoked";
}

export const processEnrollmentMaintenance = async ({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<EnrollmentMaintenanceResult> => {
  const pool = getPool();
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
        e.expiry_warning_1d_sent_at,
        u.name,
        u.email,
        c.id as course_id,
        c.title as course_title
      from enrollments e
      join users u on u.id = e.user_id
      join courses c on c.id = e.course_id
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

    try {
      await sendAccessExpiryWarningEmail({
        courseId: enrollment.course_id,
        courseTitle: enrollment.course_title,
        daysRemaining: warningKind === "1d" ? 1 : 7,
        to: enrollment.email,
        userName: enrollment.name,
      });
    } catch {
      warningFailureCount += 1;
      continue;
    }

    await pool.query(
      `
        update enrollments
        set expiry_warning_7d_sent_at =
              case when $2 = '7d' then now() else expiry_warning_7d_sent_at end,
            expiry_warning_1d_sent_at =
              case when $2 = '1d' then now() else expiry_warning_1d_sent_at end,
            updated_at = now()
        where id = $1
      `,
      [enrollment.id, warningKind]
    );

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
