import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { applyPaymentRevocation } from "@/features/enrollments/server";
import type {
  AsaasGateway,
  AsaasPayment,
  AsaasRefundEvidence,
} from "@/features/payments/asaas";
import { getAsaasProviderPaymentTransition } from "@/features/payments/asaas-financial-events";
import { runCoordinatedAsaasQuery } from "@/features/payments/asaas-query-policy";
import { findExactAsaasRefundEvidence } from "@/features/payments/asaas-refund-evidence";
import type { PersistedOrderStatus } from "@/features/payments/financial-policy";
import { getAsaasProviderClient } from "@/features/payments/provider";

const STATEMENT_PAGE_SIZE = 100;
const MAX_STATEMENT_PAGES = 100;

interface ReconciliationOrder {
  amountInCents: number;
  courseId: string;
  externalId: string;
  id: string;
  providerCheckoutId: string;
  providerInstallmentId: string | null;
  providerPaymentId: string;
  providerPaymentStatus: string | null;
  status: PersistedOrderStatus;
  userId: string | null;
}

const persistedOrderStatuses = new Set<PersistedOrderStatus>([
  "cancelled",
  "disputed",
  "paid",
  "pending",
  "refunded",
]);
const terminalOrderStatuses = new Set<PersistedOrderStatus>([
  "cancelled",
  "disputed",
  "refunded",
]);
const settledPaymentStatuses = new Set(["CONFIRMED", "RECEIVED", "REFUNDED"]);

const readReconciliationOrder = (row: unknown): ReconciliationOrder | null => {
  if (!(row && typeof row === "object")) {
    return null;
  }
  const value = row as Record<string, unknown>;
  return typeof value.id === "string" &&
    typeof value.course_id === "string" &&
    typeof value.external_id === "string" &&
    typeof value.provider_checkout_id === "string" &&
    typeof value.provider_payment_id === "string" &&
    typeof value.amount_in_cents === "number" &&
    typeof value.status === "string" &&
    persistedOrderStatuses.has(value.status as PersistedOrderStatus)
    ? {
        amountInCents: value.amount_in_cents,
        courseId: value.course_id,
        externalId: value.external_id,
        id: value.id,
        providerCheckoutId: value.provider_checkout_id,
        providerInstallmentId:
          typeof value.provider_installment_id === "string"
            ? value.provider_installment_id
            : null,
        providerPaymentStatus:
          typeof value.provider_payment_status === "string"
            ? value.provider_payment_status
            : null,
        providerPaymentId: value.provider_payment_id,
        status: value.status as PersistedOrderStatus,
        userId: typeof value.user_id === "string" ? value.user_id : null,
      }
    : null;
};

const findFullRefund = (
  payment: AsaasPayment,
  expectedAmountInCents: number
): AsaasRefundEvidence | null =>
  findExactAsaasRefundEvidence(payment.refunds, expectedAmountInCents);

type ReconciliationReviewType =
  | "amount_mismatch"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict";

interface ReconciliationDecision {
  canPersistMoney: boolean;
  canRevokeForRefund: boolean;
  refund: AsaasRefundEvidence | null;
  reviewReason: string | null;
  reviewType: ReconciliationReviewType | null;
  shouldTransitionToRefunded: boolean;
  shouldUpdateProviderPaymentStatus: boolean;
}

const decideReconciliation = ({
  order,
  payment,
}: {
  order: ReconciliationOrder;
  payment: AsaasPayment;
}): ReconciliationDecision => {
  const amountMatches = payment.valueInCents === order.amountInCents;
  const hasValidNet =
    payment.netValueInCents >= 0 &&
    payment.netValueInCents <= payment.valueInCents;
  const refund = findFullRefund(payment, order.amountInCents);
  const isRefunded = payment.status === "REFUNDED";
  const hasTerminalConflict =
    isRefunded &&
    terminalOrderStatuses.has(order.status) &&
    order.status !== "refunded";
  const providerTransition = getAsaasProviderPaymentTransition({
    currentStatus: order.providerPaymentStatus,
    incomingStatus: payment.status,
    isAdverseEvent: isRefunded,
    orderStatus: order.status,
  });

  let reviewType: ReconciliationReviewType | null = null;
  let reviewReason: string | null = null;
  if (!amountMatches) {
    reviewType = "amount_mismatch";
    reviewReason = `Valor conciliado (${payment.valueInCents}) diverge do snapshot do Pedido (${order.amountInCents}).`;
  } else if (hasTerminalConflict) {
    reviewType = "terminal_conflict";
    reviewReason = `O Pedido ja esta terminal em ${order.status}; a conciliacao retornou refunded.`;
  } else if (isRefunded && !refund) {
    reviewType =
      payment.refunds.length > 0 ? "partial_refund" : "event_anomaly";
    reviewReason =
      payment.refunds.length > 0
        ? "O Asaas retornou reembolso sem evidencia do valor integral do Pedido."
        : "O Asaas retornou status REFUNDED sem evidencia de reembolso integral.";
  } else if (isRefunded && !order.userId) {
    reviewType = "event_anomaly";
    reviewReason =
      "O Pedido reembolsado nao possui Conta correlacionada para verificar a Concessao.";
  } else if (!hasValidNet) {
    reviewType = "event_anomaly";
    reviewReason =
      "O valor liquido conciliado e invalido para o valor bruto do Pedido.";
  } else if (providerTransition.isRegression) {
    reviewType = "event_anomaly";
    reviewReason =
      "A conciliacao retornou estado regressivo para a evidencia de pagamento preservada.";
  }

  const canRevokeForRefund = isRefunded && amountMatches && refund !== null;
  return {
    canPersistMoney:
      amountMatches &&
      hasValidNet &&
      !providerTransition.isRegression &&
      settledPaymentStatuses.has(payment.status),
    canRevokeForRefund,
    refund,
    reviewReason,
    reviewType,
    shouldTransitionToRefunded:
      canRevokeForRefund && !hasTerminalConflict && order.status !== "refunded",
    shouldUpdateProviderPaymentStatus: providerTransition.shouldUpdate,
  };
};

const insertReconciliationReview = async ({
  client,
  orderId,
  reason,
  type,
}: {
  client: PoolClient;
  orderId: string;
  reason: string;
  type: ReconciliationReviewType;
}): Promise<void> => {
  await client.query(
    `insert into payment_reviews (order_id, type, reason)
     select $1, $2::payment_review_type, $3
     where not exists (
       select 1
       from payment_reviews
       where order_id = $1 and type = $2::payment_review_type and status = 'pending'
     )`,
    [orderId, type, reason]
  );
};

const auditReconciliation = async ({
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
    `insert into audit_logs (actor_user_id, action, target_type, target_id)
     values ($1, $2, 'order', $3)`,
    [actorUserId, action, orderId]
  );
};

const resolveInstallmentPaymentStatus = (
  payments: readonly AsaasPayment[],
  hasFullRefund: boolean
): string => {
  if (hasFullRefund) {
    return "REFUNDED";
  }
  if (payments.every((payment) => payment.status === "RECEIVED")) {
    return "RECEIVED";
  }
  if (
    payments.every(
      (payment) =>
        payment.status === "CONFIRMED" || payment.status === "RECEIVED"
    )
  ) {
    return "CONFIRMED";
  }
  return payments[0]?.status ?? "PENDING";
};

const getReconciliationPayment = async ({
  gateway,
  order,
}: {
  gateway: AsaasGateway;
  order: ReconciliationOrder;
}): Promise<AsaasPayment> => {
  if (!order.providerInstallmentId) {
    return await runCoordinatedAsaasQuery({
      operation: () => gateway.getPayment(order.providerPaymentId),
    });
  }

  const installment = await runCoordinatedAsaasQuery({
    operation: () => gateway.getInstallment(order.providerInstallmentId ?? ""),
  });
  const page = await runCoordinatedAsaasQuery({
    operation: () =>
      gateway.listInstallmentPayments(order.providerInstallmentId ?? ""),
  });
  const payments = page.data;
  const hasExactPayments =
    installment.id === order.providerInstallmentId &&
    installment.checkoutSession === order.providerCheckoutId &&
    installment.valueInCents === order.amountInCents &&
    installment.installmentCount === page.totalCount &&
    payments.length === page.totalCount &&
    payments.some((payment) => payment.id === order.providerPaymentId) &&
    payments.every(
      (payment) =>
        payment.installmentId === installment.id &&
        payment.checkoutSession === order.providerCheckoutId
    );
  if (!hasExactPayments) {
    throw new Error("A consulta Asaas nao corresponde ao Pedido informado.");
  }
  const hasFullRefund =
    findExactAsaasRefundEvidence(installment.refunds, order.amountInCents) !==
    null;
  return {
    billingType: installment.billingType,
    checkoutSession: installment.checkoutSession,
    customer: payments[0]?.customer ?? "",
    externalReference: null,
    id: order.providerPaymentId,
    installmentId: installment.id,
    netValueInCents: installment.netValueInCents,
    refunds: installment.refunds,
    status: resolveInstallmentPaymentStatus(payments, hasFullRefund),
    valueInCents: installment.valueInCents,
  };
};

export const reconcileAsaasPayment = async ({
  actorUserId,
  gateway = getAsaasProviderClient(),
  orderId,
}: {
  actorUserId: string;
  gateway?: AsaasGateway;
  orderId: string;
}): Promise<void> => {
  const pool = getPool();
  const initial = await pool.query(
    `select id, course_id, user_id, external_id, provider_checkout_id,
            provider_payment_id, provider_installment_id,
            provider_payment_status, amount_in_cents, status
     from orders
     where id = $1 and provider = 'asaas'`,
    [orderId]
  );
  const order = readReconciliationOrder(initial.rows[0]);
  if (!order) {
    throw new Error("Pedido Asaas sem pagamento correlacionado.");
  }

  const payment = await getReconciliationPayment({ gateway, order });
  const paymentIdMatches = payment.id === order.providerPaymentId;
  const externalReferenceMatches =
    payment.externalReference === null ||
    payment.externalReference === order.externalId;
  const checkoutSessionMatches =
    payment.checkoutSession === null ||
    payment.checkoutSession === order.providerCheckoutId;
  const hasExactOrderReference =
    payment.externalReference === order.externalId ||
    payment.checkoutSession === order.providerCheckoutId;
  if (
    !(
      paymentIdMatches &&
      externalReferenceMatches &&
      checkoutSessionMatches &&
      hasExactOrderReference
    )
  ) {
    throw new Error("A consulta Asaas nao corresponde ao Pedido informado.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const locked = await client.query(
      `select id, course_id, user_id, external_id, provider_checkout_id,
              provider_payment_id, provider_installment_id,
              provider_payment_status, amount_in_cents, status
       from orders
       where id = $1 and provider = 'asaas'
       for update`,
      [orderId]
    );
    const current = readReconciliationOrder(locked.rows[0]);
    if (
      !current ||
      current.providerPaymentId !== payment.id ||
      current.providerInstallmentId !== order.providerInstallmentId ||
      current.providerCheckoutId !== order.providerCheckoutId ||
      current.externalId !== order.externalId
    ) {
      throw new Error("O Pedido mudou durante a conciliacao.");
    }

    const decision = decideReconciliation({ order: current, payment });
    const feeInCents = payment.valueInCents - payment.netValueInCents;
    await client.query(
      `update orders
       set provider_payment_status =
             case when $9 then $2 else provider_payment_status end,
           payment_method = $3,
           paid_amount_in_cents =
             case when $10 then $4 else paid_amount_in_cents end,
           net_amount_in_cents =
             case when $10 then $5 else net_amount_in_cents end,
           fee_amount_in_cents =
             case when $10 then $6 else fee_amount_in_cents end,
           receipt_url = coalesce($7, receipt_url),
           updated_at = now()
       where id = $1 and provider_payment_id = $8`,
      [
        orderId,
        payment.status,
        payment.billingType,
        payment.valueInCents,
        payment.netValueInCents,
        feeInCents,
        payment.transactionReceiptUrl ?? null,
        payment.id,
        decision.shouldUpdateProviderPaymentStatus,
        decision.canPersistMoney,
      ]
    );

    if (decision.reviewType && decision.reviewReason) {
      await insertReconciliationReview({
        client,
        orderId,
        reason: decision.reviewReason,
        type: decision.reviewType,
      });
    }

    if (decision.canRevokeForRefund && decision.refund) {
      const now = new Date();
      if (current.userId) {
        await applyPaymentRevocation({
          client,
          courseId: current.courseId,
          now,
          orderId,
          reason: "payment_refund",
          userId: current.userId,
        });
      }
      await client.query(
        `update orders
         set status = case when $3 then 'refunded' else status end,
             provider_refund_status = $2,
             refunded_at =
               case when $3 then coalesce(refunded_at, $4) else refunded_at end,
             updated_at = now()
         where id = $1`,
        [
          orderId,
          decision.refund.status,
          decision.shouldTransitionToRefunded,
          now,
        ]
      );
      await client.query(
        `update refund_requests
         set status = 'confirmed',
             provider_refund_status = $2,
             provider_refund_created_at = $3,
             provider_refund_end_to_end_id = $4,
             provider_refund_receipt_url = $5,
             provider_refunded_amount_in_cents = $6,
             confirmed_at = coalesce(confirmed_at, $7),
             error_message = null,
             updated_at = now()
         where order_id = $1`,
        [
          orderId,
          decision.refund.status,
          decision.refund.dateCreated,
          decision.refund.endToEndIdentifier ?? null,
          decision.refund.transactionReceiptUrl ?? null,
          decision.refund.valueInCents,
          now,
        ]
      );
    }
    await auditReconciliation({
      action: "asaas.payment_reconciled",
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
};

export const importAsaasFinancialStatement = async ({
  actorUserId,
  finishDate,
  gateway = getAsaasProviderClient(),
  startDate,
}: {
  actorUserId: string;
  finishDate: string;
  gateway?: AsaasGateway;
  startDate: string;
}): Promise<{ imported: number }> => {
  const pool = getPool();
  let imported = 0;
  let offset = 0;
  for (let pageNumber = 0; pageNumber < MAX_STATEMENT_PAGES; pageNumber += 1) {
    const page = await runCoordinatedAsaasQuery({
      operation: () =>
        gateway.listFinancialTransactions({
          finishDate,
          limit: STATEMENT_PAGE_SIZE,
          offset,
          order: "asc",
          startDate,
        }),
    });
    for (const transaction of page.data) {
      const result = await pool.query(
        `insert into asaas_financial_transactions (
           provider_transaction_id,
           transaction_date,
           transaction_type,
           value_in_cents
         )
         values ($1, $2, $3, $4)
         on conflict (provider_transaction_id) do update set
           transaction_date = excluded.transaction_date,
           transaction_type = excluded.transaction_type,
           value_in_cents = excluded.value_in_cents,
           updated_at = now()
         returning id`,
        [
          transaction.id,
          transaction.date,
          transaction.type,
          transaction.valueInCents,
        ]
      );
      imported += result.rows.length;
    }
    if (!page.hasMore) {
      await pool.query(
        `insert into audit_logs (actor_user_id, action, target_type, target_id)
         values ($1, 'asaas.statement_imported', 'asaas_statement', $2)`,
        [actorUserId, `${startDate}:${finishDate}`]
      );
      return { imported };
    }
    offset += page.limit;
  }
  throw new Error("Extrato Asaas excedeu o limite seguro de paginacao.");
};
