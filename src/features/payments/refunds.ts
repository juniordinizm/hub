import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { verifyPassword } from "@better-auth/utils/password";
import type { Pool, PoolClient } from "pg";
import { getPool } from "@/db";
import type {
  AsaasGateway,
  AsaasPayment,
  AsaasRefundEvidence,
} from "@/features/payments/asaas";
import { AsaasGatewayError } from "@/features/payments/asaas-client";
import { getAsaasProviderClient } from "@/features/payments/provider";
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

const auditRefund = async ({
  action,
  actorUserId,
  client,
  orderId,
}: {
  action: string;
  actorUserId: string;
  client: PoolClient;
  orderId: string;
}): Promise<void> => {
  await client.query(
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

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `
        delete from verifications
        where identifier = $1
      `,
      [identifier]
    );
    await client.query(
      `
        insert into verifications (id, identifier, value, expires_at)
        values ($1, $2, $3, $4)
      `,
      [randomUUID(), identifier, tokenDigest(confirmationToken), expiresAt]
    );
    await auditRefund({
      action: "refund.password_confirmed",
      actorUserId,
      client,
      orderId,
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return { confirmationToken };
};

interface RefundRequestInput {
  actorUserId: string;
  confirmationToken: string;
  gateway?: AsaasGateway;
  orderId: string;
  reason: string;
  typedOrderId: string;
}

interface ReservedRefund {
  amountInCents: number;
  externalReference: string;
  providerPaymentId: string;
  refundRequestId: string;
}

const reserveRefund = async ({
  actorUserId,
  client,
  confirmationToken,
  orderId,
  reason,
}: Omit<RefundRequestInput, "gateway" | "typedOrderId"> & {
  client: PoolClient;
}): Promise<ReservedRefund> => {
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
      amount_in_cents: number;
      external_id: string;
      provider_payment_id: string | null;
      status: "cancelled" | "disputed" | "paid" | "pending" | "refunded";
    }>(
      `
        select amount_in_cents, external_id, provider_payment_id, status
        from orders
        where id = $1
          and provider = 'asaas'
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
        insert into refund_requests (order_id, requested_by_user_id, reason, status)
        values ($1, $2, $3, 'processing')
        on conflict (order_id) do update set
          requested_by_user_id = excluded.requested_by_user_id,
          reason = excluded.reason,
          status = 'processing',
          provider_refund_status = null,
          provider_refund_created_at = null,
          provider_refund_end_to_end_id = null,
          provider_refund_receipt_url = null,
          provider_refunded_amount_in_cents = null,
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

    if (!selectedOrder.provider_payment_id) {
      throw new Error("Pedido sem pagamento Asaas para reembolso.");
    }
    await auditRefund({
      action: "refund.requested",
      actorUserId,
      client,
      orderId,
    });
    await client.query("commit");
    return {
      amountInCents: selectedOrder.amount_in_cents,
      externalReference: selectedOrder.external_id,
      providerPaymentId: selectedOrder.provider_payment_id,
      refundRequestId: reservation.rows[0].id,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const getSafeRefundErrorCode = (error: unknown): string => {
  if (error instanceof AsaasGatewayError) {
    return error.providerCode ?? `asaas_refund_${error.kind}`;
  }
  if (
    error instanceof Error &&
    error.message === "asaas_refund_invalid_result"
  ) {
    return error.message;
  }
  return "asaas_refund_unknown_outcome";
};

const persistRefundFailure = async ({
  actorUserId,
  error,
  orderId,
  pool,
  refundRequestId,
}: {
  actorUserId: string;
  error: unknown;
  orderId: string;
  pool: Pool;
  refundRequestId: string;
}): Promise<void> => {
  const rejected =
    error instanceof AsaasGatewayError && error.outcome === "rejected";
  const status = rejected ? "failed" : "uncertain";
  const failureClient = await pool.connect();
  try {
    await failureClient.query("begin");
    const transition = await failureClient.query<{ id: string }>(
      `
        update refund_requests
        set status = '${status}',
            error_message = $2,
            updated_at = now()
        where id = $1 and status = 'processing'
        returning id
      `,
      [refundRequestId, getSafeRefundErrorCode(error)]
    );
    if (transition.rows[0]) {
      await auditRefund({
        action: rejected ? "refund.rejected" : "refund.uncertain",
        actorUserId,
        client: failureClient,
        orderId,
      });
    } else {
      const current = await failureClient.query<{ status: string }>(
        "select status from refund_requests where id = $1",
        [refundRequestId]
      );
      if (current.rows[0]?.status === "confirmed") {
        await failureClient.query("commit");
        return;
      }
    }
    await failureClient.query("commit");
  } catch (failureError) {
    await failureClient.query("rollback");
    throw failureError;
  } finally {
    failureClient.release();
  }
  throw new Error(
    rejected
      ? "Solicitacao de reembolso rejeitada pelo Asaas."
      : "Resultado do reembolso pendente de conciliacao."
  );
};

export const requestFullRefund = async ({
  actorUserId,
  confirmationToken,
  gateway = getAsaasProviderClient(),
  orderId,
  reason,
  typedOrderId,
}: RefundRequestInput): Promise<void> => {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error("Informe o motivo do estorno.");
  }
  if (typedOrderId.trim() !== orderId) {
    throw new Error("A confirmacao digitada do pedido nao confere.");
  }

  const pool = getPool();
  const reserved = await reserveRefund({
    actorUserId,
    client: await pool.connect(),
    confirmationToken,
    orderId,
    reason: normalizedReason,
  });
  try {
    const response = await gateway.refundPayment({
      description: normalizedReason,
      paymentId: reserved.providerPaymentId,
    });
    const evidence =
      response.id === reserved.providerPaymentId
        ? findExactRefundEvidence(response, reserved.amountInCents)
        : undefined;
    if (
      !evidence ||
      response.externalReference !== reserved.externalReference
    ) {
      throw new Error("asaas_refund_invalid_result");
    }
    const persisted = await pool.query<{ id: string }>(
      `update refund_requests
       set status = 'processing',
           provider_refund_status = $2,
           provider_refund_created_at = $3,
           provider_refund_end_to_end_id = $4,
           provider_refund_receipt_url = $5,
           provider_refunded_amount_in_cents = $6,
           error_message = null,
           updated_at = now()
       where id = $1 and status = 'processing'
       returning id`,
      [
        reserved.refundRequestId,
        evidence.status,
        evidence.dateCreated,
        evidence.endToEndIdentifier ?? null,
        evidence.transactionReceiptUrl ?? null,
        evidence.valueInCents,
      ]
    );
    if (!persisted.rows[0]) {
      const current = await pool.query<{ status: string }>(
        "select status from refund_requests where id = $1",
        [reserved.refundRequestId]
      );
      if (current.rows[0]?.status !== "confirmed") {
        throw new Error("asaas_refund_invalid_result");
      }
    }
  } catch (error) {
    await persistRefundFailure({
      actorUserId,
      error,
      orderId,
      pool,
      refundRequestId: reserved.refundRequestId,
    });
  }
};

const findExactRefundEvidence = (
  payment: AsaasPayment,
  expectedAmountInCents: number
): AsaasRefundEvidence | undefined =>
  payment.refunds.find(
    (refund) => refund.valueInCents === expectedAmountInCents
  );
