import "server-only";
import { getPool } from "@/db";

export interface AdminOverview {
  activeEnrollments: number;
  courses: number;
  paidOrders: number;
  recentWebhooks: Array<{
    eventKey: string;
    eventName: string;
    status: string;
    createdAt: Date;
  }>;
  students: number;
}

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const pool = getPool();
  const [counts, webhooks] = await Promise.all([
    pool.query<{
      courses: number;
      students: number;
      active_enrollments: number;
      paid_orders: number;
    }>(
      `
        select
          (select count(*)::int from courses) as courses,
          (select count(*)::int from profiles where role = 'student') as students,
          (select count(*)::int from enrollments where status = 'active') as active_enrollments,
          (select count(*)::int from orders where status = 'paid') as paid_orders
      `
    ),
    pool.query<{
      event_key: string;
      event_name: string;
      status: string;
      created_at: Date;
    }>(
      `
        select event_key, event_name, status, created_at
        from webhook_events
        order by created_at desc
        limit 8
      `
    ),
  ]);
  const countRow = counts.rows[0];

  return {
    courses: countRow?.courses ?? 0,
    students: countRow?.students ?? 0,
    activeEnrollments: countRow?.active_enrollments ?? 0,
    paidOrders: countRow?.paid_orders ?? 0,
    recentWebhooks: webhooks.rows.map((row) => ({
      eventKey: row.event_key,
      eventName: row.event_name,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
};
