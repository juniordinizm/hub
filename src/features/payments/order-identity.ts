import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeBuyerEmail } from "./buyer-identity";

export interface OrderIdentityQueryClient {
  query(queryText: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface LockedOrderIdentity {
  buyerIdentityStatus: "pending" | "resolved" | "review_required";
  courseId: string;
  customerEmail: string | null;
  customerName: string | null;
  orderId: string;
  userId: string | null;
}

export interface LocalOrderIdentityResult {
  activationRequired: boolean;
  userId: string;
}

export type LocalOrderIdentityErrorCode =
  | "buyer_identity_course_revoked"
  | "buyer_identity_platform_blocked"
  | "buyer_identity_team_account"
  | "order_identity_conflict"
  | "order_identity_incomplete"
  | "order_user_not_found";

export class LocalOrderIdentityError extends Error {
  readonly code: LocalOrderIdentityErrorCode;

  constructor(code: LocalOrderIdentityErrorCode) {
    super(code);
    this.code = code;
  }
}

const getRowField = (row: unknown, field: string): unknown => {
  if (!row || typeof row !== "object" || !(field in row)) {
    return;
  }
  return Reflect.get(row, field);
};

const getRowString = (row: unknown, field: string): string | null => {
  const value = getRowField(row, field);
  return typeof value === "string" && value ? value : null;
};

const findEligibleUserByEmail = async ({
  client,
  courseId,
  email,
}: {
  client: OrderIdentityQueryClient;
  courseId: string;
  email: string;
}): Promise<unknown> => {
  const result = await client.query(
    `select
       u.id,
       p.role,
       p.platform_blocked_at,
       exists(
         select 1
         from enrollments e
         where e.user_id = u.id
           and e.course_id = $2
           and e.status = 'revoked'
       ) as course_revoked
     from users u
     left join profiles p on p.user_id = u.id
     where lower(u.email) = $1
     limit 1`,
    [email, courseId]
  );
  return result.rows[0];
};

const findEligibleUserById = async ({
  client,
  courseId,
  userId,
}: {
  client: OrderIdentityQueryClient;
  courseId: string;
  userId: string;
}): Promise<unknown> => {
  const result = await client.query(
    `select
       u.id,
       p.role,
       p.platform_blocked_at,
       exists(
         select 1
         from enrollments e
         where e.user_id = u.id
           and e.course_id = $2
           and e.status = 'revoked'
       ) as course_revoked
     from users u
     left join profiles p on p.user_id = u.id
     where u.id = $1
     limit 1`,
    [userId, courseId]
  );
  return result.rows[0];
};

const requireEligibleStudent = (row: unknown): string => {
  const userId = getRowString(row, "id");
  if (!userId) {
    throw new LocalOrderIdentityError("order_user_not_found");
  }
  if (getRowString(row, "role") !== "student") {
    throw new LocalOrderIdentityError("buyer_identity_team_account");
  }
  if (getRowField(row, "platform_blocked_at") != null) {
    throw new LocalOrderIdentityError("buyer_identity_platform_blocked");
  }
  if (getRowField(row, "course_revoked") === true) {
    throw new LocalOrderIdentityError("buyer_identity_course_revoked");
  }
  return userId;
};

const hasCredentialAccount = async ({
  client,
  userId,
}: {
  client: OrderIdentityQueryClient;
  userId: string;
}): Promise<boolean> => {
  const result = await client.query(
    `select id
     from accounts
     where user_id = $1 and provider_id = 'credential'
     limit 1`,
    [userId]
  );
  return getRowString(result.rows[0], "id") !== null;
};

const linkPendingOrder = async ({
  client,
  orderId,
  userId,
}: {
  client: OrderIdentityQueryClient;
  orderId: string;
  userId: string;
}): Promise<void> => {
  const linkedOrder = await client.query(
    `update orders
     set user_id = $2,
         buyer_identity_status = 'resolved',
         updated_at = now()
     where id = $1
       and user_id is null
       and buyer_identity_status = 'pending'
     returning user_id`,
    [orderId, userId]
  );
  if (getRowString(linkedOrder.rows[0], "user_id") === userId) {
    return;
  }

  const currentOrder = await client.query(
    `select user_id, buyer_identity_status
     from orders
     where id = $1
     limit 1`,
    [orderId]
  );
  if (
    getRowString(currentOrder.rows[0], "user_id") !== userId ||
    getRowString(currentOrder.rows[0], "buyer_identity_status") !== "resolved"
  ) {
    throw new LocalOrderIdentityError("order_identity_conflict");
  }
};

export const resolveLocalOrderIdentity = async ({
  client,
  order,
}: {
  client: OrderIdentityQueryClient;
  order: LockedOrderIdentity;
}): Promise<LocalOrderIdentityResult> => {
  if (order.userId) {
    const row = await findEligibleUserById({
      client,
      courseId: order.courseId,
      userId: order.userId,
    });
    const userId = requireEligibleStudent(row);
    return {
      activationRequired: !(await hasCredentialAccount({ client, userId })),
      userId,
    };
  }

  if (!(order.customerEmail?.trim() && order.customerName?.trim())) {
    throw new LocalOrderIdentityError("order_identity_incomplete");
  }

  const normalizedEmail = normalizeBuyerEmail(order.customerEmail);
  let userRow = await findEligibleUserByEmail({
    client,
    courseId: order.courseId,
    email: normalizedEmail,
  });

  if (!getRowString(userRow, "id")) {
    const insertedUser = await client.query(
      `insert into users (id, name, email, email_verified)
       values ($1, $2, $3, false)
       on conflict (lower(email)) do nothing
       returning id`,
      [randomUUID(), order.customerName.trim(), normalizedEmail]
    );
    const insertedUserId = getRowString(insertedUser.rows[0], "id");
    if (insertedUserId) {
      await client.query(
        `insert into profiles (user_id, role)
         values ($1, 'student')
         on conflict (user_id) do nothing`,
        [insertedUserId]
      );
    }
    userRow = await findEligibleUserByEmail({
      client,
      courseId: order.courseId,
      email: normalizedEmail,
    });
  }

  const userId = requireEligibleStudent(userRow);
  await linkPendingOrder({ client, orderId: order.orderId, userId });
  return {
    activationRequired: !(await hasCredentialAccount({ client, userId })),
    userId,
  };
};
