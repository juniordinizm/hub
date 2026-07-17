import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { verifyPassword } from "@better-auth/utils/password";
import { getPool } from "@/db";
import { AbacatePayClient } from "@/features/payments/abacatepay-client";
import { getServerEnv } from "@/lib/env";

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

const confirmationIdentifier = ({
  actorUserId,
  orderId,
}: {
  actorUserId: string;
  orderId: string;
}): string => `refund-confirmation:${actorUserId}:${orderId}`;

const tokenDigest = (token: string): string =>
  createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(token)
    .digest("hex");

const getAbacatePayClient = (): AbacatePayClient => {
  const env = getServerEnv();
  const apiKey = env.ABACATE_PAY_API_KEY ?? env.ABACATEPAY_API_KEY;

  if (!apiKey) {
    throw new Error("Configure ABACATE_PAY_API_KEY para solicitar estornos.");
  }

  return new AbacatePayClient({
    apiKey,
    baseUrl: env.ABACATEPAY_API_BASE_URL,
  });
};

const auditRefund = async ({
  action,
  actorUserId,
  orderId,
}: {
  action: string;
  actorUserId: string;
  orderId: string;
}): Promise<void> => {
  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, $2, 'order', $3)
    `,
    [actorUserId, action, orderId]
  );
};

export const issueRefundConfirmation = async ({
  actorUserId,
  orderId,
  password,
}: {
  actorUserId: string;
  orderId: string;
  password: string;
}): Promise<{ confirmationToken: string }> => {
  if (!password) {
    throw new Error("Informe sua senha atual para continuar.");
  }

  const account = await getPool().query<{ password: string | null }>(
    `
      select password
      from accounts
      where user_id = $1
        and provider_id = 'credential'
      limit 1
    `,
    [actorUserId]
  );
  const passwordHash = account.rows[0]?.password;

  if (!(passwordHash && (await verifyPassword(passwordHash, password)))) {
    throw new Error("Senha atual invalida.");
  }

  const confirmationToken = randomUUID();
  const identifier = confirmationIdentifier({ actorUserId, orderId });
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  await getPool().query(
    `
      delete from verifications
      where identifier = $1
    `,
    [identifier]
  );
  await getPool().query(
    `
      insert into verifications (id, identifier, value, expires_at)
      values ($1, $2, $3, $4)
    `,
    [randomUUID(), identifier, tokenDigest(confirmationToken), expiresAt]
  );
  await auditRefund({
    action: "refund.password_confirmed",
    actorUserId,
    orderId,
  });

  return { confirmationToken };
};

export const requestFullRefund = async ({
  actorUserId,
  confirmationToken,
  orderId,
  reason,
  typedOrderId,
}: {
  actorUserId: string;
  confirmationToken: string;
  orderId: string;
  reason: string;
  typedOrderId: string;
}): Promise<void> => {
  if (!reason.trim()) {
    throw new Error("Informe o motivo do estorno.");
  }
  if (typedOrderId.trim() !== orderId) {
    throw new Error("A confirmacao digitada do pedido nao confere.");
  }

  const pool = getPool();
  const client = await pool.connect();
  let providerOrderId: string;

  try {
    await client.query("begin");
    const confirmation = await client.query<{ id: string }>(
      `
        delete from verifications
        where identifier = $1
          and value = $2
          and expires_at > now()
        returning id
      `,
      [
        confirmationIdentifier({ actorUserId, orderId }),
        tokenDigest(confirmationToken),
      ]
    );

    if (!confirmation.rows[0]) {
      throw new Error("A confirmacao expirou ou ja foi utilizada.");
    }

    const order = await client.query<{
      provider_order_id: string;
      status: "cancelled" | "disputed" | "paid" | "pending" | "refunded";
    }>(
      `
        select provider_order_id, status
        from orders
        where id = $1
          and provider = 'abacatepay'
        for update
      `,
      [orderId]
    );
    const selectedOrder = order.rows[0];

    if (selectedOrder?.status !== "paid") {
      throw new Error("Somente pedidos pagos podem ser estornados.");
    }

    const reservation = await client.query<{ id: string }>(
      `
        insert into refund_requests (order_id, requested_by_user_id, reason)
        values ($1, $2, $3)
        on conflict (order_id) do update set
          requested_by_user_id = excluded.requested_by_user_id,
          reason = excluded.reason,
          status = 'requested',
          provider_refund_id = null,
          error_message = null,
          updated_at = now()
        where refund_requests.status = 'failed'
        returning id
      `,
      [orderId, actorUserId, reason.trim()]
    );

    if (!reservation.rows[0]) {
      throw new Error("Ja existe uma solicitacao de estorno para este pedido.");
    }

    providerOrderId = selectedOrder.provider_order_id;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  await auditRefund({ action: "refund.requested", actorUserId, orderId });

  try {
    const response = await getAbacatePayClient().refundCheckout({
      checkoutId: providerOrderId,
      reason: reason.trim(),
    });
    await pool.query(
      `
        update refund_requests
        set provider_refund_id = $2,
            updated_at = now()
        where order_id = $1
      `,
      [orderId, response.refundPublicId]
    );
  } catch (error) {
    await pool.query(
      `
        update refund_requests
        set status = 'failed',
            error_message = $2,
            updated_at = now()
        where order_id = $1
      `,
      [orderId, error instanceof Error ? error.message : "Erro desconhecido"]
    );
    await auditRefund({ action: "refund.failed", actorUserId, orderId });
    throw error;
  }
};
