import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { getServerEnv } from "@/lib/env";

const auditPrivacy = async ({
  action,
  actorUserId,
  client,
  requestId,
}: {
  action: string;
  actorUserId: string;
  client: PoolClient;
  requestId: string;
}): Promise<void> => {
  await client.query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, $2, 'privacy_request', $3)
    `,
    [actorUserId, action, requestId]
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

  const request = await getPool().query<{ id: string }>(
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

  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, 'privacy.requested', 'privacy_request', $2)
    `,
    [actorUserId, requestId]
  );
  return { id: requestId };
};

export const approvePrivacyRequest = async ({
  actorUserId,
  requestId,
}: {
  actorUserId: string;
  requestId: string;
}): Promise<void> => {
  const updated = await getPool().query<{ id: string }>(
    `
      update privacy_requests
      set status = 'approved',
          resolved_by_user_id = $2,
          resolved_at = now(),
          updated_at = now()
      where id = $1
        and status = 'requested'
      returning id
    `,
    [requestId, actorUserId]
  );

  if (!updated.rows[0]) {
    throw new Error("Solicitacao de privacidade invalida.");
  }

  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, 'privacy.approved', 'privacy_request', $2)
    `,
    [actorUserId, requestId]
  );
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

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const request = await client.query<{ user_id: string }>(
      `
        update privacy_requests
        set status = 'completed',
            resolved_by_user_id = $2,
            resolved_at = now(),
            updated_at = now()
        where id = $1
          and status = 'approved'
        returning user_id
      `,
      [requestId, actorUserId]
    );
    const userId = request.rows[0]?.user_id;

    if (!userId) {
      throw new Error(
        "Solicitacao ainda nao foi aprovada ou ja foi executada."
      );
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
