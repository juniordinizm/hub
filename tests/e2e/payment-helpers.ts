import type { APIRequestContext } from "@playwright/test";
import { Pool } from "pg";
import { assertSafeE2eDatabaseEnvironment } from "../../src/db/e2e-database-guard";

const WEBHOOK_TOKEN = "e2e-webhook-token-with-at-least-32-characters";
const CRON_SECRET = "e2e-cron-secret";

const requireE2eDatabaseUrl = (): string => {
  assertSafeE2eDatabaseEnvironment(process.env);
  const databaseUrl = process.env.E2E_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("E2E database guard accepted an absent database URL.");
  }
  return databaseUrl;
};

export const setE2ePlatformBlock = async ({
  blocked,
  userId,
}: {
  blocked: boolean;
  userId: string;
}): Promise<void> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query(
      `update profiles
       set platform_blocked_at = case when $2 then now() else null end,
           platform_blocked_reason = case when $2 then 'e2e_checkout_guard' else null end,
           updated_at = now()
       where user_id = $1`,
      [userId, blocked]
    );
    if (result.rowCount !== 1) {
      throw new Error("E2E platform block fixture was not found.");
    }
  } finally {
    await pool.end();
  }
};

interface CheckoutMutationOutcome {
  orderCount: number;
  providerCheckoutCount: number;
}

export const readCheckoutMutationOutcome = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<CheckoutMutationOutcome> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{
      order_count: string;
      provider_checkout_count: string;
    }>(
      `select
         count(*)::text as order_count,
         count(*) filter (
           where provider_checkout_id is not null or checkout_attempt_count > 0
         )::text as provider_checkout_count
       from orders
       where user_id = $1 and course_id = $2`,
      [userId, courseId]
    );
    return {
      orderCount: Number(result.rows[0]?.order_count ?? "0"),
      providerCheckoutCount: Number(
        result.rows[0]?.provider_checkout_count ?? "0"
      ),
    };
  } finally {
    await pool.end();
  }
};

export interface OrderOutcome {
  accountLinked: boolean;
  activationCount: number;
  activeEnrollmentCount: number;
  buyerIdentityStatus: "pending" | "resolved" | "review_required";
  enrollmentCount: number;
  grantCount: number;
  status: "cancelled" | "disputed" | "paid" | "pending" | "refunded";
  studentProfileCount: number;
  unverifiedAccount: boolean;
}

export const sendPaidWebhook = async ({
  attemptId,
  customerId = "cus_e2e",
  request,
}: {
  attemptId: string;
  customerId?: string;
  request: APIRequestContext;
}): Promise<void> => {
  const response = await request.post("/api/webhooks/asaas", {
    data: {
      event: "PAYMENT_RECEIVED",
      id: `evt_${attemptId}`,
      payment: {
        billingType: "PIX",
        checkoutSession: `chk_${attemptId}`,
        customer: customerId,
        externalReference: `order_${attemptId}`,
        id: `pay_${attemptId}`,
        netValue: 10,
        status: "RECEIVED",
        value: 10,
      },
    },
    headers: { "asaas-access-token": WEBHOOK_TOKEN },
  });
  if (!response.ok()) {
    throw new Error(`Asaas webhook E2E failed with HTTP ${response.status()}.`);
  }
};

export const runAsaasWorker = async (
  request: APIRequestContext
): Promise<void> => {
  const response = await request.get("/api/cron/asaas-webhooks", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!response.ok()) {
    throw new Error(`Asaas worker E2E failed with HTTP ${response.status()}.`);
  }
};

interface BuyerIdentityReviewOutcome {
  accessOutboxCount: number;
  buyerIdentityStatus: OrderOutcome["buyerIdentityStatus"];
  enrollmentCount: number;
  grantCount: number;
  pendingReviewCount: number;
  status: OrderOutcome["status"];
}

export const readBuyerIdentityReviewOutcome = async (
  attemptId: string
): Promise<BuyerIdentityReviewOutcome> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{
      access_outbox_count: string;
      buyer_identity_status: OrderOutcome["buyerIdentityStatus"];
      enrollment_count: string;
      grant_count: string;
      pending_review_count: string;
      status: OrderOutcome["status"];
    }>(
      `select
         o.status,
         o.buyer_identity_status,
         (
           select count(*)
           from payment_reviews pr
           where pr.order_id = o.id
             and pr.type = 'buyer_identity'
             and pr.status = 'pending'
         )::text as pending_review_count,
         (
           select count(*)
           from enrollment_grants eg
           where eg.order_id = o.id
         )::text as grant_count,
         (
           select count(*)
           from enrollments e
           join users u on u.id = e.user_id
           where lower(u.email) = lower(o.customer_email)
             and e.course_id = o.course_id
         )::text as enrollment_count,
         (
           select count(*)
           from outbox_messages om
           where om.aggregate_type = 'order'
             and om.aggregate_id = o.id::text
             and om.topic in ('auth.account-activation', 'email.access-released')
         )::text as access_outbox_count
       from orders o
       where o.id = $1
       limit 1`,
      [attemptId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Buyer identity review E2E order was not found.");
    }
    return {
      accessOutboxCount: Number(row.access_outbox_count),
      buyerIdentityStatus: row.buyer_identity_status,
      enrollmentCount: Number(row.enrollment_count),
      grantCount: Number(row.grant_count),
      pendingReviewCount: Number(row.pending_review_count),
      status: row.status,
    };
  } finally {
    await pool.end();
  }
};

export const readOrderOutcome = async (
  attemptId: string
): Promise<OrderOutcome> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{
      activation_count: string;
      active_enrollment_count: string;
      account_linked: boolean;
      buyer_identity_status: OrderOutcome["buyerIdentityStatus"];
      enrollment_count: string;
      grant_count: string;
      status: OrderOutcome["status"];
      student_profile_count: string;
      unverified_account: boolean;
    }>(
      `select
         o.status,
         o.buyer_identity_status,
         (o.user_id is not null) as account_linked,
         exists (
           select 1
           from users u
           where u.id = o.user_id
             and u.email_verified = false
         ) as unverified_account,
         (
           select count(*)
           from profiles p
           where p.user_id = o.user_id
             and p.role = 'student'
         )::text as student_profile_count,
         (
           select count(*)
           from enrollment_grants eg
           where eg.order_id = o.id
         )::text as grant_count,
         (
           select count(*)
           from enrollments e
           where e.user_id = o.user_id
             and e.course_id = o.course_id
         )::text as enrollment_count,
         (
           select count(*)
           from enrollments e
           where e.user_id = o.user_id
             and e.course_id = o.course_id
             and e.status = 'active'
             and e.starts_at <= now()
             and e.expires_at >= now()
         )::text as active_enrollment_count,
         (
           select count(*)
           from outbox_messages om
           where om.aggregate_type = 'order'
             and om.aggregate_id = o.id::text
             and om.topic = 'auth.account-activation'
         )::text as activation_count
       from orders o
       where o.id = $1
       limit 1`,
      [attemptId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Financial E2E order was not found.");
    }
    return {
      activationCount: Number(row.activation_count),
      activeEnrollmentCount: Number(row.active_enrollment_count),
      accountLinked: row.account_linked,
      buyerIdentityStatus: row.buyer_identity_status,
      enrollmentCount: Number(row.enrollment_count),
      grantCount: Number(row.grant_count),
      studentProfileCount: Number(row.student_profile_count),
      status: row.status,
      unverifiedAccount: row.unverified_account,
    };
  } finally {
    await pool.end();
  }
};

interface AuthenticatedOrderIdentityOutcome {
  buyerIdentityResolved: boolean;
  grantCount: number;
  providerIdentityIgnored: boolean;
  sessionEmailPreserved: boolean;
  sessionNamePreserved: boolean;
  sessionUserPreserved: boolean;
  status: OrderOutcome["status"];
}

export const readAuthenticatedOrderIdentity = async ({
  attemptId,
  expectedUserId,
}: {
  attemptId: string;
  expectedUserId: string;
}): Promise<AuthenticatedOrderIdentityOutcome> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{
      buyer_identity_resolved: boolean;
      grant_count: string;
      provider_identity_ignored: boolean;
      session_email_preserved: boolean;
      session_name_preserved: boolean;
      session_user_preserved: boolean;
      status: OrderOutcome["status"];
    }>(
      `select
         o.status,
         (o.buyer_identity_status = 'resolved') as buyer_identity_resolved,
         (
           select count(*)
           from enrollment_grants eg
           where eg.order_id = o.id
         )::text as grant_count,
         (o.user_id = $2) as session_user_preserved,
         (o.customer_email = u.email) as session_email_preserved,
         (o.customer_name = u.name) as session_name_preserved,
         (o.provider_customer_id is null) as provider_identity_ignored
       from orders o
       join users u on u.id = $2
       where o.id = $1
       limit 1`,
      [attemptId, expectedUserId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Authenticated financial E2E order was not found.");
    }
    return {
      buyerIdentityResolved: row.buyer_identity_resolved,
      grantCount: Number(row.grant_count),
      providerIdentityIgnored: row.provider_identity_ignored,
      sessionEmailPreserved: row.session_email_preserved,
      sessionNamePreserved: row.session_name_preserved,
      sessionUserPreserved: row.session_user_preserved,
      status: row.status,
    };
  } finally {
    await pool.end();
  }
};

interface CheckoutDeduplicationOutcome {
  checkoutAttemptCount: number;
  orderCount: number;
  providerCheckoutMatchesAttempt: boolean;
}

export const readCheckoutDeduplicationOutcome = async (
  attemptId: string
): Promise<CheckoutDeduplicationOutcome> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{
      checkout_attempt_count: number | null;
      order_count: string;
      provider_checkout_matches_attempt: boolean | null;
    }>(
      `select
         count(*)::text as order_count,
         max(checkout_attempt_count) as checkout_attempt_count,
         bool_and(provider_checkout_id = $2) as provider_checkout_matches_attempt
       from orders
       where id = $1`,
      [attemptId, `chk_${attemptId}`]
    );
    const row = result.rows[0];
    return {
      checkoutAttemptCount: row?.checkout_attempt_count ?? 0,
      orderCount: Number(row?.order_count ?? "0"),
      providerCheckoutMatchesAttempt:
        row?.provider_checkout_matches_attempt ?? false,
    };
  } finally {
    await pool.end();
  }
};

export const readPaymentEventCount = async (
  attemptId: string
): Promise<number> => {
  const pool = new Pool({ connectionString: requireE2eDatabaseUrl() });
  try {
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from webhook_events
       where provider = 'asaas' and event_key = $1`,
      [`evt_${attemptId}`]
    );
    return Number(result.rows[0]?.count ?? "0");
  } finally {
    await pool.end();
  }
};
