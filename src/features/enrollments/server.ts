import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  getExtendedEnrollmentExpiration,
  getRenewedAccessWindow,
  validateEnrollmentAdjustmentReason,
} from "@/features/enrollments/rules";

type EnrollmentGrantStatus =
  | "active"
  | "cancelled"
  | "disputed"
  | "expired"
  | "refunded";

type PaymentRevocationReason = "abacatepay_dispute" | "abacatepay_refund";

interface EnrollmentEventInput {
  actorUserId?: string | null;
  courseId: string;
  enrollmentId?: string | null;
  eventType:
    | "access_manual_block_removed"
    | "access_manually_blocked"
    | "expiration_adjustment_reversed"
    | "expiration_extended"
    | "expiration_set"
    | "payment_disputed"
    | "payment_paid"
    | "payment_refunded"
    | "projection_rebuilt";
  grantId?: string | null;
  metadata?: Record<string, unknown>;
  orderId?: string | null;
  userId: string;
}

interface ActiveGrantProjectionRow {
  expires_at: Date;
  starts_at: Date;
}

interface LatestGrantRow {
  effective_expires_at: Date;
  revoked_reason: string | null;
  status: EnrollmentGrantStatus;
}

interface EnrollmentProjectionRow {
  id: string;
}

interface EnrollmentGrantRow {
  base_expires_at: Date;
  course_id: string;
  effective_expires_at: Date;
  id: string;
  status: EnrollmentGrantStatus;
  user_id: string;
}

interface EnrollmentCourseAccessRow {
  course_id: string;
  user_id: string;
}

interface EnrollmentGrantAccessRow extends EnrollmentGrantRow {
  revoked_reason: string | null;
}

const MANUAL_ACCESS_BLOCK_REASON = "manual_access_block";

export type ExpirationChangeType = "extension" | "reduction" | "unchanged";

export interface ExpirationChangeResult {
  baseExpiresAt: Date;
  changeType: ExpirationChangeType;
  newExpiresAt: Date;
  previousExpiresAt: Date;
}

const resolveExpirationChangeType = ({
  newExpiresAt,
  previousExpiresAt,
}: {
  newExpiresAt: Date;
  previousExpiresAt: Date;
}): ExpirationChangeType => {
  if (newExpiresAt > previousExpiresAt) {
    return "extension";
  }

  if (newExpiresAt < previousExpiresAt) {
    return "reduction";
  }

  return "unchanged";
};

const insertEnrollmentEvent = async (
  client: PoolClient,
  {
    actorUserId = null,
    courseId,
    enrollmentId = null,
    eventType,
    grantId = null,
    metadata = {},
    orderId = null,
    userId,
  }: EnrollmentEventInput
): Promise<void> => {
  await client.query(
    `
      insert into enrollment_events (
        event_type,
        user_id,
        course_id,
        enrollment_id,
        grant_id,
        order_id,
        actor_user_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      eventType,
      userId,
      courseId,
      enrollmentId,
      grantId,
      orderId,
      actorUserId,
      JSON.stringify(metadata),
    ]
  );
};

const getCurrentRenewalBase = async ({
  client,
  courseId,
  paidAt,
  userId,
}: {
  client: PoolClient;
  courseId: string;
  paidAt: Date;
  userId: string;
}): Promise<Date | null> => {
  const { rows } = await client.query<{ current_expires_at: Date | null }>(
    `
      select max(effective_expires_at) as current_expires_at
      from enrollment_grants
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and starts_at <= $3
        and effective_expires_at > $3
    `,
    [userId, courseId, paidAt]
  );

  return rows[0]?.current_expires_at ?? null;
};

export const rebuildEnrollmentProjection = async ({
  client,
  courseId,
  now = new Date(),
  userId,
}: {
  client: PoolClient;
  courseId: string;
  now?: Date;
  userId: string;
}): Promise<void> => {
  await client.query(
    `
      update enrollment_grants
      set status = 'expired',
          updated_at = now()
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and effective_expires_at < $3
    `,
    [userId, courseId, now]
  );

  const activeGrant = await client.query<ActiveGrantProjectionRow>(
    `
      select
        min(starts_at) as starts_at,
        max(effective_expires_at) as expires_at
      from enrollment_grants
      where user_id = $1
        and course_id = $2
        and status = 'active'
        and starts_at <= $3
        and effective_expires_at >= $3
    `,
    [userId, courseId, now]
  );
  const activeProjection = activeGrant.rows[0];

  if (activeProjection?.starts_at && activeProjection.expires_at) {
    const { rows } = await client.query<EnrollmentProjectionRow>(
      `
        insert into enrollments (
          user_id,
          course_id,
          status,
          starts_at,
          expires_at,
          revoked_at,
          revoked_reason,
          expiry_warning_7d_sent_at,
          expiry_warning_1d_sent_at
        )
        values ($1, $2, 'active', $3, $4, null, null, null, null)
        on conflict (user_id, course_id) do update set
          status = 'active',
          starts_at = excluded.starts_at,
          expires_at = excluded.expires_at,
          revoked_at = null,
          revoked_reason = null,
          expiry_warning_7d_sent_at = case
            when enrollments.expires_at = excluded.expires_at
              then enrollments.expiry_warning_7d_sent_at
            else null
          end,
          expiry_warning_1d_sent_at = case
            when enrollments.expires_at = excluded.expires_at
              then enrollments.expiry_warning_1d_sent_at
            else null
          end,
          updated_at = now()
        returning id
      `,
      [
        userId,
        courseId,
        activeProjection.starts_at,
        activeProjection.expires_at,
      ]
    );

    await insertEnrollmentEvent(client, {
      courseId,
      enrollmentId: rows[0]?.id ?? null,
      eventType: "projection_rebuilt",
      metadata: { status: "active" },
      userId,
    });
    return;
  }

  const latestGrant = await client.query<LatestGrantRow>(
    `
      select status, effective_expires_at, revoked_reason
      from enrollment_grants
      where user_id = $1 and course_id = $2
      order by effective_expires_at desc, updated_at desc
      limit 1
    `,
    [userId, courseId]
  );
  const latest = latestGrant.rows[0];

  if (!latest) {
    return;
  }

  const projectionStatus =
    latest.status === "refunded" ||
    latest.status === "disputed" ||
    latest.status === "cancelled"
      ? "revoked"
      : "expired";
  const revokedReason =
    projectionStatus === "revoked"
      ? (latest.revoked_reason ?? latest.status)
      : null;
  const { rows } = await client.query<EnrollmentProjectionRow>(
    `
      insert into enrollments (
        user_id,
        course_id,
        status,
        starts_at,
        expires_at,
        revoked_at,
        revoked_reason
      )
      values ($1, $2, $3::enrollment_status, $4, $4, case when $3 = 'revoked' then now() else null end, $5)
      on conflict (user_id, course_id) do update set
        status = excluded.status,
        expires_at = excluded.expires_at,
        revoked_at = excluded.revoked_at,
        revoked_reason = excluded.revoked_reason,
        updated_at = now()
      returning id
    `,
    [
      userId,
      courseId,
      projectionStatus,
      latest.effective_expires_at,
      revokedReason,
    ]
  );

  await insertEnrollmentEvent(client, {
    courseId,
    enrollmentId: rows[0]?.id ?? null,
    eventType: "projection_rebuilt",
    metadata: { status: projectionStatus },
    userId,
  });
};

export const applyPaidWebhookAccess = async ({
  accessDurationMonths,
  client,
  courseId,
  now,
  orderId,
  userId,
}: {
  accessDurationMonths: number;
  client: PoolClient;
  courseId: string;
  now: Date;
  orderId: string;
  userId: string;
}): Promise<void> => {
  const currentExpiresAt = await getCurrentRenewalBase({
    client,
    courseId,
    paidAt: now,
    userId,
  });
  const { expiresAt } = getRenewedAccessWindow({
    accessDurationMonths,
    currentExpiresAt,
    paidAt: now,
  });
  const { rows } = await client.query<{ id: string }>(
    `
      insert into enrollment_grants (
        user_id,
        course_id,
        source_type,
        source_id,
        status,
        starts_at,
        base_expires_at,
        effective_expires_at,
        revoked_at,
        revoked_reason
      )
      values ($1, $2, 'abacatepay_order', $3, 'active', $4, $5, $5, null, null)
      on conflict (source_type, source_id) do update set
        status = case
          when enrollment_grants.status in ('refunded', 'disputed', 'cancelled')
            then enrollment_grants.status
          else 'active'::enrollment_grant_status
        end,
        effective_expires_at = case
          when enrollment_grants.status in ('refunded', 'disputed', 'cancelled')
            then enrollment_grants.effective_expires_at
          else greatest(
            enrollment_grants.effective_expires_at,
            excluded.effective_expires_at
          )
        end,
        revoked_at = case
          when enrollment_grants.status in ('refunded', 'disputed', 'cancelled')
            then enrollment_grants.revoked_at
          else null
        end,
        revoked_reason = case
          when enrollment_grants.status in ('refunded', 'disputed', 'cancelled')
            then enrollment_grants.revoked_reason
          else null
        end,
        updated_at = now()
      returning id
    `,
    [userId, courseId, orderId, now, expiresAt]
  );
  const grantId = rows[0]?.id ?? null;

  await insertEnrollmentEvent(client, {
    courseId,
    eventType: "payment_paid",
    grantId,
    metadata: { accessDurationMonths, expiresAt: expiresAt.toISOString() },
    orderId,
    userId,
  });
  await rebuildEnrollmentProjection({ client, courseId, now, userId });
};

export const applyPaymentRevocation = async ({
  client,
  courseId,
  now,
  orderId,
  reason,
  userId,
}: {
  client: PoolClient;
  courseId: string;
  now: Date;
  orderId: string;
  reason: PaymentRevocationReason;
  userId: string;
}): Promise<void> => {
  const status = reason === "abacatepay_dispute" ? "disputed" : "refunded";
  const { rows } = await client.query<{ id: string }>(
    `
      update enrollment_grants
      set status = $1::enrollment_grant_status,
          revoked_at = $2,
          revoked_reason = $3,
          updated_at = now()
      where source_type = 'abacatepay_order'
        and source_id = $4
      returning id
    `,
    [status, now, reason, orderId]
  );
  const grantId = rows[0]?.id ?? null;

  await insertEnrollmentEvent(client, {
    courseId,
    eventType:
      reason === "abacatepay_dispute" ? "payment_disputed" : "payment_refunded",
    grantId,
    metadata: { reason },
    orderId,
    userId,
  });
  await rebuildEnrollmentProjection({ client, courseId, now, userId });
};

const getActivePaidGrantForEnrollment = async ({
  client,
  enrollmentId,
}: {
  client: PoolClient;
  enrollmentId: string;
}): Promise<EnrollmentGrantRow> => {
  const { rows } = await client.query<EnrollmentGrantRow>(
    `
      select
        eg.id,
        eg.user_id,
        eg.course_id,
        eg.status,
        eg.base_expires_at,
        eg.effective_expires_at
      from enrollments e
      join enrollment_grants eg
        on eg.user_id = e.user_id
       and eg.course_id = e.course_id
      where e.id = $1
        and eg.source_type = 'abacatepay_order'
        and eg.status in ('active', 'expired')
      order by eg.effective_expires_at desc
      limit 1
    `,
    [enrollmentId]
  );
  const grant = rows[0];

  if (!grant) {
    throw new Error("Matricula sem pagamento AbacatePay ajustavel.");
  }

  return grant;
};

const getEnrollmentCourseAccess = async ({
  client,
  enrollmentId,
}: {
  client: PoolClient;
  enrollmentId: string;
}): Promise<EnrollmentCourseAccessRow> => {
  const { rows } = await client.query<EnrollmentCourseAccessRow>(
    `
      select user_id, course_id
      from enrollments
      where id = $1
      limit 1
    `,
    [enrollmentId]
  );
  const enrollment = rows[0];

  if (!enrollment) {
    throw new Error("Matricula invalida.");
  }

  return enrollment;
};

const getPaidAccessGrantsForEnrollment = async ({
  client,
  enrollmentId,
  statuses,
}: {
  client: PoolClient;
  enrollmentId: string;
  statuses: EnrollmentGrantStatus[];
}): Promise<EnrollmentGrantAccessRow[]> => {
  const { rows } = await client.query<EnrollmentGrantAccessRow>(
    `
      select
        eg.id,
        eg.user_id,
        eg.course_id,
        eg.status,
        eg.base_expires_at,
        eg.effective_expires_at,
        eg.revoked_reason
      from enrollments e
      join enrollment_grants eg
        on eg.user_id = e.user_id
       and eg.course_id = e.course_id
      where e.id = $1
        and eg.source_type = 'abacatepay_order'
        and eg.status = any($2::enrollment_grant_status[])
      order by eg.effective_expires_at desc
    `,
    [enrollmentId, statuses]
  );

  return rows;
};

export const extendEnrollmentExpiration = async ({
  actorUserId,
  days = 0,
  enrollmentId,
  months = 0,
  now = new Date(),
  reason,
}: {
  actorUserId: string;
  days?: number;
  enrollmentId: string;
  months?: number;
  now?: Date;
  reason: string;
}): Promise<void> => {
  const normalizedReason = validateEnrollmentAdjustmentReason(reason);

  if (days === 0 && months === 0) {
    throw new Error("Informe um periodo para estender a expiracao.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const grant = await getActivePaidGrantForEnrollment({
      client,
      enrollmentId,
    });
    const newExpiresAt = getExtendedEnrollmentExpiration({
      currentEffectiveExpiresAt: grant.effective_expires_at,
      days,
      months,
      now,
    });
    const adjustmentType = months ? "extend_months" : "extend_days";

    await client.query(
      `
        insert into enrollment_expiration_adjustments (
          grant_id,
          adjustment_type,
          delta_days,
          delta_months,
          previous_expires_at,
          new_expires_at,
          reason,
          actor_user_id
        )
        values ($1, $2::enrollment_adjustment_type, $3, $4, $5, $6, $7, $8)
      `,
      [
        grant.id,
        adjustmentType,
        days || null,
        months || null,
        grant.effective_expires_at,
        newExpiresAt,
        normalizedReason,
        actorUserId,
      ]
    );
    await client.query(
      `
        update enrollment_grants
        set status = 'active',
            effective_expires_at = $2,
            revoked_at = null,
            revoked_reason = null,
            updated_at = now()
        where id = $1
      `,
      [grant.id, newExpiresAt]
    );
    await insertEnrollmentEvent(client, {
      actorUserId,
      courseId: grant.course_id,
      eventType: "expiration_extended",
      grantId: grant.id,
      metadata: { days, months, reason: normalizedReason },
      userId: grant.user_id,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId: grant.course_id,
      now,
      userId: grant.user_id,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const setEnrollmentExpiration = async ({
  actorUserId,
  enrollmentId,
  newExpiresAt,
  now = new Date(),
  reason,
}: {
  actorUserId: string;
  enrollmentId: string;
  newExpiresAt: Date;
  now?: Date;
  reason: string;
}): Promise<ExpirationChangeResult> => {
  const normalizedReason = validateEnrollmentAdjustmentReason(reason);
  const client = await getPool().connect();
  let result: ExpirationChangeResult | null = null;

  try {
    await client.query("begin");

    const grant = await getActivePaidGrantForEnrollment({
      client,
      enrollmentId,
    });
    result = {
      baseExpiresAt: grant.base_expires_at,
      changeType: resolveExpirationChangeType({
        newExpiresAt,
        previousExpiresAt: grant.effective_expires_at,
      }),
      newExpiresAt,
      previousExpiresAt: grant.effective_expires_at,
    };

    await client.query(
      `
        insert into enrollment_expiration_adjustments (
          grant_id,
          adjustment_type,
          previous_expires_at,
          new_expires_at,
          reason,
          actor_user_id
        )
        values ($1, 'set_exact_expiration', $2, $3, $4, $5)
      `,
      [
        grant.id,
        grant.effective_expires_at,
        newExpiresAt,
        normalizedReason,
        actorUserId,
      ]
    );
    await client.query(
      `
        update enrollment_grants
        set status = case
              when $2 < $3 then 'expired'::enrollment_grant_status
              else 'active'::enrollment_grant_status
            end,
            effective_expires_at = $2,
            updated_at = now()
        where id = $1
      `,
      [grant.id, newExpiresAt, now]
    );
    await insertEnrollmentEvent(client, {
      actorUserId,
      courseId: grant.course_id,
      eventType: "expiration_set",
      grantId: grant.id,
      metadata: {
        changeType: result.changeType,
        baseExpiresAt: grant.base_expires_at.toISOString(),
        newExpiresAt: newExpiresAt.toISOString(),
        previousExpiresAt: grant.effective_expires_at.toISOString(),
        reason: normalizedReason,
      },
      userId: grant.user_id,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId: grant.course_id,
      now,
      userId: grant.user_id,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (!result) {
    throw new Error("Nao foi possivel ajustar a expiracao.");
  }

  return result;
};

export const reverseExpirationAdjustment = async ({
  actorUserId,
  adjustmentId,
  now = new Date(),
  reason,
}: {
  actorUserId: string;
  adjustmentId: string;
  now?: Date;
  reason: string;
}): Promise<void> => {
  const normalizedReason = validateEnrollmentAdjustmentReason(reason);
  const client = await getPool().connect();
  try {
    await client.query("begin");

    const { rows } = await client.query<{
      course_id: string;
      grant_id: string;
      previous_expires_at: Date;
      user_id: string;
    }>(
      `
        select
          adjustment.grant_id,
          adjustment.previous_expires_at,
          eg.user_id,
          eg.course_id
        from enrollment_expiration_adjustments adjustment
        join enrollment_grants eg on eg.id = adjustment.grant_id
        where adjustment.id = $1
        limit 1
      `,
      [adjustmentId]
    );
    const adjustment = rows[0];

    if (!adjustment) {
      throw new Error("Ajuste de expiracao invalido.");
    }

    await client.query(
      `
        insert into enrollment_expiration_adjustments (
          grant_id,
          adjustment_type,
          previous_expires_at,
          new_expires_at,
          reason,
          actor_user_id,
          reversed_adjustment_id
        )
        values ($1, 'reversal', $2, $3, $4, $5, $6)
      `,
      [
        adjustment.grant_id,
        now,
        adjustment.previous_expires_at,
        normalizedReason,
        actorUserId,
        adjustmentId,
      ]
    );
    await client.query(
      `
        update enrollment_grants
        set effective_expires_at = $2,
            updated_at = now()
        where id = $1
      `,
      [adjustment.grant_id, adjustment.previous_expires_at]
    );
    await insertEnrollmentEvent(client, {
      actorUserId,
      courseId: adjustment.course_id,
      eventType: "expiration_adjustment_reversed",
      grantId: adjustment.grant_id,
      metadata: { adjustmentId, reason: normalizedReason },
      userId: adjustment.user_id,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId: adjustment.course_id,
      now,
      userId: adjustment.user_id,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const blockEnrollmentAccess = async ({
  actorUserId,
  enrollmentId,
  now = new Date(),
  reason,
}: {
  actorUserId: string;
  enrollmentId: string;
  now?: Date;
  reason: string;
}): Promise<void> => {
  const normalizedReason = validateEnrollmentAdjustmentReason(reason);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const enrollment = await getEnrollmentCourseAccess({
      client,
      enrollmentId,
    });
    const grants = await getPaidAccessGrantsForEnrollment({
      client,
      enrollmentId,
      statuses: ["active", "expired"],
    });

    if (grants.length === 0) {
      throw new Error("Nao ha acesso pago ajustavel para bloquear.");
    }

    await client.query(
      `
        update enrollment_grants
        set status = 'cancelled',
            revoked_at = $2,
            revoked_reason = $3,
            updated_at = now()
        where id = any($1::uuid[])
      `,
      [grants.map((grant) => grant.id), now, MANUAL_ACCESS_BLOCK_REASON]
    );

    for (const grant of grants) {
      await insertEnrollmentEvent(client, {
        actorUserId,
        courseId: grant.course_id,
        enrollmentId,
        eventType: "access_manually_blocked",
        grantId: grant.id,
        metadata: { reason: normalizedReason },
        userId: grant.user_id,
      });
    }

    await rebuildEnrollmentProjection({
      client,
      courseId: enrollment.course_id,
      now,
      userId: enrollment.user_id,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const restoreEnrollmentAccess = async ({
  actorUserId,
  enrollmentId,
  now = new Date(),
  reason,
}: {
  actorUserId: string;
  enrollmentId: string;
  now?: Date;
  reason: string;
}): Promise<void> => {
  const normalizedReason = validateEnrollmentAdjustmentReason(reason);
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const enrollment = await getEnrollmentCourseAccess({
      client,
      enrollmentId,
    });
    const grants = (
      await getPaidAccessGrantsForEnrollment({
        client,
        enrollmentId,
        statuses: ["cancelled"],
      })
    ).filter((grant) => grant.revoked_reason === MANUAL_ACCESS_BLOCK_REASON);

    if (grants.length === 0) {
      throw new Error("Nao ha bloqueio manual para restaurar.");
    }

    await client.query(
      `
        update enrollment_grants
        set status = case
              when effective_expires_at < $2 then 'expired'::enrollment_grant_status
              else 'active'::enrollment_grant_status
            end,
            revoked_at = null,
            revoked_reason = null,
            updated_at = now()
        where id = any($1::uuid[])
      `,
      [grants.map((grant) => grant.id), now]
    );

    for (const grant of grants) {
      await insertEnrollmentEvent(client, {
        actorUserId,
        courseId: grant.course_id,
        enrollmentId,
        eventType: "access_manual_block_removed",
        grantId: grant.id,
        metadata: { reason: normalizedReason },
        userId: grant.user_id,
      });
    }

    await rebuildEnrollmentProjection({
      client,
      courseId: enrollment.course_id,
      now,
      userId: enrollment.user_id,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const resolveCourseAccess = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<boolean> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select e.id
      from enrollments e
      join courses c on c.id = e.course_id
      where e.user_id = $1
        and e.course_id = $2
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      limit 1
    `,
    [userId, courseId]
  );

  return Boolean(rows[0]);
};

export const resolveLessonAccess = async ({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<boolean> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select e.id
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join enrollments e on e.course_id = c.id
      where l.id = $2
        and e.user_id = $1
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
        and m.status = 'active'
        and l.status = 'active'
      limit 1
    `,
    [userId, lessonId]
  );

  return Boolean(rows[0]);
};
