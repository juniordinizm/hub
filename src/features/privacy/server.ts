import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import { getServerEnv } from "@/lib/env";

export interface PrivacyRequestRecord {
  approvedAt: Date | null;
  approvedByUserId: string | null;
  createdAt: Date;
  executedAt: Date | null;
  executedByUserId: string | null;
  id: string;
  reason: string;
  requestedByUserId: string | null;
  status: "approved" | "completed" | "rejected" | "requested";
  studentEmail: string;
  studentName: string;
  userId: string;
}

export const listPrivacyRequests = async (): Promise<
  PrivacyRequestRecord[]
> => {
  await requirePermission("managePrivacyRequests");
  const { rows } = await getPool().query<{
    approved_at: Date | null;
    approved_by_user_id: string | null;
    created_at: Date;
    executed_at: Date | null;
    executed_by_user_id: string | null;
    id: string;
    reason: string;
    requested_by_user_id: string | null;
    status: PrivacyRequestRecord["status"];
    student_email: string;
    student_name: string;
    user_id: string;
  }>(`
    select pr.id, pr.user_id, pr.requested_by_user_id, pr.status, pr.reason,
           pr.approved_by_user_id, pr.approved_at, pr.executed_by_user_id,
           pr.executed_at, pr.created_at, u.name as student_name,
           u.email as student_email
    from privacy_requests pr
    join users u on u.id = pr.user_id
    order by pr.created_at desc
  `);

  return rows.map((row) => ({
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
    createdAt: row.created_at,
    executedAt: row.executed_at,
    executedByUserId: row.executed_by_user_id,
    id: row.id,
    reason: row.reason,
    requestedByUserId: row.requested_by_user_id,
    status: row.status,
    studentEmail: row.student_email,
    studentName: row.student_name,
    userId: row.user_id,
  }));
};

export const listPrivacyRequestStudents = async (): Promise<
  Array<{ email: string; id: string; name: string }>
> => {
  await requirePermission("managePrivacyRequests");
  const { rows } = await getPool().query<{
    email: string;
    id: string;
    name: string;
  }>(`
    select u.id, u.name, u.email
    from users u
    join profiles p on p.user_id = u.id
    where p.role = 'student'
    order by u.name
  `);
  return rows;
};

const auditPrivacy = async ({
  action,
  actorUserId,
  client,
  metadata = {},
  requestId,
}: {
  action: string;
  actorUserId: string;
  client: PoolClient;
  metadata?: Record<string, string>;
  requestId: string;
}): Promise<void> => {
  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
      values ($1, $2, 'privacy_request', $3, $4::jsonb)
    `,
    [actorUserId, action, requestId, JSON.stringify(metadata)]
  );
};

export const registerPrivacyRequest = async ({
  actorUserId,
  reason,
  userId,
}: {
  actorUserId: string;
  reason: string;
  userId: string;
}): Promise<{ id: string }> => {
  if (!(userId && reason.trim())) {
    throw new Error(
      "Informe a aluna e o motivo da solicitacao de privacidade."
    );
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const request = await client.query<{ id: string }>(
      `
        insert into privacy_requests (user_id, requested_by_user_id, reason)
        values ($1, $2, $3)
        returning id
      `,
      [userId, actorUserId, reason.trim()]
    );
    const requestId = request.rows[0]?.id;

    if (!requestId) {
      throw new Error("Nao foi possivel registrar a solicitacao.");
    }

    await auditPrivacy({
      action: "privacy.requested",
      actorUserId,
      client,
      requestId,
    });
    await client.query("commit");
    return { id: requestId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const approvePrivacyRequest = async ({
  actorUserId,
  requestId,
}: {
  actorUserId: string;
  requestId: string;
}): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const updated = await client.query<{ id: string }>(
      `
        update privacy_requests
        set status = 'approved',
            approved_by_user_id = $2,
            approved_at = now(),
            updated_at = now()
        where id = $1
          and status = 'requested'
          and requested_by_user_id is distinct from $2
        returning id
      `,
      [requestId, actorUserId]
    );

    if (!updated.rows[0]) {
      throw new Error("Solicitacao nao esta elegivel para aprovacao.");
    }

    await auditPrivacy({
      action: "privacy.approved",
      actorUserId,
      client,
      requestId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const executePrivacyAnonymization = async ({
  actorUserId,
  requestId,
}: {
  actorUserId: string;
  requestId: string;
}): Promise<void> => {
  if (!getServerEnv().DATA_RETENTION_ENABLED) {
    throw new Error("Anonimizacao desabilitada ate a aprovacao juridica/LGPD.");
  }

  const env = getServerEnv();

  if (!env.LEGAL_APPROVAL_REFERENCE?.trim()) {
    throw new Error(
      "Anonimizacao desabilitada sem referencia juridica formal aprovada."
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await client.query<{ user_id: string }>(
      `
        update privacy_requests
        set status = 'completed',
            executed_by_user_id = $2,
            executed_at = now(),
            resolved_by_user_id = $2,
            resolved_at = now(),
            updated_at = now()
        where id = $1
          and status = 'approved'
          and approved_by_user_id is not null
          and requested_by_user_id is distinct from $2
          and approved_by_user_id is distinct from $2
        returning user_id
      `,
      [requestId, actorUserId]
    );
    const userId = request.rows[0]?.user_id;

    if (!userId) {
      throw new Error("Solicitacao nao esta elegivel para execucao.");
    }

    const anonymousEmail = `anonimizado-${userId}@invalid.local`;
    await client.query(
      `
        update users
        set name = 'Dados anonimizados',
            email = $2,
            image = null,
            email_verified = false,
            updated_at = now()
        where id = $1
      `,
      [userId, anonymousEmail]
    );
    await client.query(
      `
        update profiles
        set phone = null,
            platform_blocked_reason = null,
            updated_at = now()
        where user_id = $1
      `,
      [userId]
    );
    await client.query("delete from sessions where user_id = $1", [userId]);
    await client.query("delete from verifications where identifier like $1", [
      `%${userId}%`,
    ]);
    await client.query(
      `
        update accounts
        set access_token = null,
            refresh_token = null,
            id_token = null,
            password = null,
            updated_at = now()
        where user_id = $1
      `,
      [userId]
    );
    await auditPrivacy({
      action: "privacy.anonymized",
      actorUserId,
      client,
      metadata: { legalApprovalReference: env.LEGAL_APPROVAL_REFERENCE },
      requestId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const runDataRetention = async (): Promise<{
  enabled: boolean;
  expiredSessionsRemoved: number;
  expiredRateLimitsRemoved: number;
}> => {
  if (!getServerEnv().DATA_RETENTION_ENABLED) {
    return {
      enabled: false,
      expiredRateLimitsRemoved: 0,
      expiredSessionsRemoved: 0,
    };
  }

  const [sessions, rateLimits] = await Promise.all([
    getPool().query("delete from sessions where expires_at < now()"),
    getPool().query(
      "delete from public_certificate_rate_limits where expires_at < now()"
    ),
  ]);
  await getPool().query(
    `
      insert into audit_logs (action, target_type, metadata)
      values ('retention.executed', 'retention', $1::jsonb)
    `,
    [
      JSON.stringify({
        expiredRateLimitsRemoved: rateLimits.rowCount ?? 0,
        expiredSessionsRemoved: sessions.rowCount ?? 0,
      }),
    ]
  );

  return {
    enabled: true,
    expiredRateLimitsRemoved: rateLimits.rowCount ?? 0,
    expiredSessionsRemoved: sessions.rowCount ?? 0,
  };
};
