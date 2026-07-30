import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeBuyerEmail } from "./buyer-identity";

export interface OrderIdentityQueryClient {
  query(queryText: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface LockedOrderIdentity {
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

const getRowString = (row: unknown, field: string): string | null => {
  if (!row || typeof row !== "object" || !(field in row)) {
    return null;
  }
  const value = Reflect.get(row, field);
  return typeof value === "string" && value ? value : null;
};

export const resolveLocalOrderIdentity = async ({
  client,
  order,
}: {
  client: OrderIdentityQueryClient;
  order: LockedOrderIdentity;
}): Promise<LocalOrderIdentityResult> => {
  if (order.userId) {
    const user = await client.query(
      "select id from users where id = $1 limit 1",
      [order.userId]
    );
    if (!getRowString(user.rows[0], "id")) {
      throw new LocalOrderIdentityError("order_user_not_found");
    }

    return {
      activationRequired: !(await hasCredentialAccount({
        client,
        userId: order.userId,
      })),
      userId: order.userId,
    };
  }

  if (!(order.customerEmail?.trim() && order.customerName?.trim())) {
    throw new LocalOrderIdentityError("order_identity_incomplete");
  }

  const normalizedEmail = normalizeBuyerEmail(order.customerEmail);
  const existingUser = await client.query(
    "select id from users where lower(email) = $1 limit 1",
    [normalizedEmail]
  );
  let userId = getRowString(existingUser.rows[0], "id");

  if (!userId) {
    await client.query(
      `insert into users (id, name, email, email_verified)
       values ($1, $2, $3, false)
       on conflict (lower(email)) do nothing`,
      [randomUUID(), order.customerName.trim(), normalizedEmail]
    );
    const convergedUser = await client.query(
      "select id from users where lower(email) = $1 limit 1",
      [normalizedEmail]
    );
    userId = getRowString(convergedUser.rows[0], "id");
    if (!userId) {
      throw new LocalOrderIdentityError("order_user_not_found");
    }

    await client.query(
      `insert into profiles (user_id, role)
       values ($1, 'student')
       on conflict (user_id) do nothing`,
      [userId]
    );
  }

  const linkedOrder = await client.query(
    `update orders
     set user_id = $2, updated_at = now()
     where id = $1 and (user_id is null or user_id = $2)
     returning user_id`,
    [order.orderId, userId]
  );
  if (getRowString(linkedOrder.rows[0], "user_id") !== userId) {
    throw new LocalOrderIdentityError("order_identity_conflict");
  }

  return {
    activationRequired: !(await hasCredentialAccount({ client, userId })),
    userId,
  };
};
