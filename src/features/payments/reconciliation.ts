import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { applyPaymentRevocation } from "@/features/enrollments/server";
import {
  applyConfirmedPaymentAccess,
  type PersistedOrderStatus,
  persistConfirmedPaymentStatus,
} from "@/features/payments/apply-authoritative-financial-evidence";
import type {
  AsaasFinancialTransaction,
  AsaasGateway,
  AsaasPayment,
  AsaasRefundEvidence,
} from "@/features/payments/asaas";
import type { AsaasBuyerIdentityPreparation } from "@/features/payments/asaas-customer-enrichment";
import { decideQueriedAsaasPayment } from "@/features/payments/asaas-financial-events";
import { runCoordinatedAsaasQuery } from "@/features/payments/asaas-query-policy";
import { findExactAsaasRefundEvidence } from "@/features/payments/asaas-refund-evidence";
import { parseBuyerIdentity } from "@/features/payments/buyer-identity";
import { closeRefundedBuyerIdentityReview } from "@/features/payments/buyer-identity-review";
import { getAsaasProviderClient } from "@/features/payments/provider";

const STATEMENT_PAGE_SIZE = 100;
const MAX_STATEMENT_PAGES = 100;

export interface FinancialStatementImportResult {
  completed: true;
  inserted: number;
  resumedFromOffset: number;
  updated: number;
}

interface ReconciliationOrder {
  accessDurationMonths: number | null;
  amountInCents: number;
  buyerIdentityStatus: "pending" | "resolved" | "review_required";
  courseId: string;
  externalId: string;
  id: string;
  providerCheckoutId: string;
  providerInstallmentId: string | null;
  providerPaymentId: string;
  providerPaymentStatus: string | null;
  providerRiskStatus: string | null;
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
const settledPaymentStatuses = new Set(["CONFIRMED", "RECEIVED", "REFUNDED"]);
const buyerIdentityStatuses = new Set([
  "pending",
  "resolved",
  "review_required",
]);

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
    typeof value.buyer_identity_status === "string" &&
    buyerIdentityStatuses.has(value.buyer_identity_status) &&
    typeof value.status === "string" &&
    persistedOrderStatuses.has(value.status as PersistedOrderStatus)
    ? {
        accessDurationMonths:
          typeof value.access_duration_months === "number"
            ? value.access_duration_months
            : null,
        amountInCents: value.amount_in_cents,
        buyerIdentityStatus: value.buyer_identity_status as
          | "pending"
          | "resolved"
          | "review_required",
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
        providerRiskStatus:
          typeof value.provider_risk_status === "string"
            ? value.provider_risk_status
            : null,
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
  | "buyer_identity"
  | "event_anomaly"
  | "partial_refund"
  | "terminal_conflict";

interface ReconciliationDecision {
  canPersistMoney: boolean;
  canRevokeForRefund: boolean;
  refund: AsaasRefundEvidence | null;
  reviewReason: string | null;
  reviewType: ReconciliationReviewType | null;
  shouldGrantAccess: boolean;
  shouldTransitionToRefunded: boolean;
  shouldUpdateProviderPaymentStatus: boolean;
}

const getReconciliationReviewReason = ({
  order,
  payment,
  reviewType,
}: {
  order: ReconciliationOrder;
  payment: AsaasPayment;
  reviewType: ReconciliationReviewType | null;
}): string | null => {
  if (reviewType === "amount_mismatch") {
    return `Valor conciliado (${payment.valueInCents}) diverge do snapshot do Pedido (${order.amountInCents}).`;
  }
  if (reviewType === "terminal_conflict") {
    return `O Pedido ja esta terminal em ${order.status}; a conciliacao retornou ${payment.status.toLowerCase()}.`;
  }
  if (reviewType === "event_anomaly") {
    return "A conciliacao retornou estado regressivo para a evidencia de pagamento preservada.";
  }
  return reviewType ? `A conciliacao exige revisao ${reviewType}.` : null;
};

const adaptQueriedPaymentDecision = ({
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
  const matrixDecision = decideQueriedAsaasPayment({
    evidence: {
      billingType: payment.billingType,
      checkoutSession: payment.checkoutSession,
      externalReference: payment.externalReference,
      installmentId: payment.installmentId ?? null,
      netValueInCents: payment.netValueInCents,
      paymentId: payment.id,
      status: payment.status,
      valueInCents: payment.valueInCents,
    },
    snapshot: {
      amountInCents: order.amountInCents,
      checkoutStatus: "active",
      orderStatus: order.status,
      providerPaymentStatus: order.providerPaymentStatus,
      providerRiskStatus: order.providerRiskStatus,
    },
  });

  let reviewType = matrixDecision.reviewReason;
  let reviewReason = getReconciliationReviewReason({
    order,
    payment,
    reviewType,
  });
  const isRefunded = payment.status === "REFUNDED";
  if (isRefunded && amountMatches && !refund) {
    reviewType =
      payment.refunds.length > 0 ? "partial_refund" : "event_anomaly";
    reviewReason =
      payment.refunds.length > 0
        ? "O Asaas retornou reembolso sem evidencia do valor integral do Pedido."
        : "O Asaas retornou status REFUNDED sem evidencia de reembolso integral.";
  } else if (
    isRefunded &&
    !order.userId &&
    order.buyerIdentityStatus !== "review_required"
  ) {
    reviewType = "event_anomaly";
    reviewReason =
      "O Pedido reembolsado nao possui Conta correlacionada para verificar a Concessao.";
  } else if (amountMatches && !hasValidNet) {
    reviewType = "event_anomaly";
    reviewReason =
      "O valor liquido conciliado e invalido para o valor bruto do Pedido.";
  }

  const canRevokeForRefund = isRefunded && amountMatches && refund !== null;
  const hasBlockingAnomaly = reviewType === "event_anomaly";
  return {
    canPersistMoney:
      amountMatches &&
      hasValidNet &&
      !hasBlockingAnomaly &&
      settledPaymentStatuses.has(payment.status),
    canRevokeForRefund,
    refund,
    reviewReason,
    reviewType,
    shouldGrantAccess: matrixDecision.effect === "grant" && reviewType === null,
    shouldTransitionToRefunded:
      canRevokeForRefund &&
      matrixDecision.updates.orderStatus === "refunded" &&
      order.status !== "refunded",
    shouldUpdateProviderPaymentStatus:
      matrixDecision.updates.providerPaymentStatus !== undefined,
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

const prepareReconciliationBuyerIdentity = async ({
  gateway,
  order,
  payment,
  shouldGrantAccess,
}: {
  gateway: AsaasGateway;
  order: ReconciliationOrder;
  payment: AsaasPayment;
  shouldGrantAccess: boolean;
}): Promise<AsaasBuyerIdentityPreparation> => {
  if (order.buyerIdentityStatus !== "pending" || !shouldGrantAccess) {
    return { kind: "not_required" };
  }

  const customer = await runCoordinatedAsaasQuery({
    operation: () => gateway.getCustomer(payment.customer),
  });
  if (customer.id !== payment.customer) {
    return {
      customerId: customer.id,
      kind: "review_required",
      orderId: order.id,
      reason: "buyer_identity_conflict",
    };
  }
  const identity = parseBuyerIdentity(customer);
  if (!identity) {
    return {
      customerId: customer.id,
      kind: "review_required",
      orderId: order.id,
      reason: "buyer_identity_invalid",
    };
  }
  return {
    customerId: customer.id,
    identity,
    kind: "resolved",
    orderId: order.id,
  };
};

const openReconciliationBuyerIdentityReview = async ({
  client,
  orderId,
  reason,
}: {
  client: PoolClient;
  orderId: string;
  reason: string;
}): Promise<void> => {
  await client.query(
    `update orders
     set buyer_identity_status = 'review_required', updated_at = now()
     where id = $1 and buyer_identity_status in ('pending', 'resolved')`,
    [orderId]
  );
  await insertReconciliationReview({
    client,
    orderId,
    reason,
    type: "buyer_identity",
  });
};

const applyReconciledConfirmedPayment = async ({
  client,
  order,
  preparation,
}: {
  client: PoolClient;
  order: ReconciliationOrder;
  preparation: AsaasBuyerIdentityPreparation;
}): Promise<void> => {
  if (preparation.kind === "review_required") {
    await persistConfirmedPaymentStatus({
      client,
      now: new Date(),
      orderId: order.id,
    });
    await openReconciliationBuyerIdentityReview({
      client,
      orderId: order.id,
      reason: preparation.reason,
    });
    return;
  }

  await applyConfirmedPaymentAccess({
    client,
    onIdentityReview: async (reason) => {
      await openReconciliationBuyerIdentityReview({
        client,
        orderId: order.id,
        reason,
      });
    },
    order: {
      accessDurationMonths: order.accessDurationMonths,
      buyerIdentityStatus: order.buyerIdentityStatus,
      courseId: order.courseId,
      id: order.id,
      status: order.status,
      userId: order.userId,
    },
    preparation,
  });
};

const hasExactPaymentCorrelation = ({
  order,
  payment,
}: {
  order: ReconciliationOrder;
  payment: AsaasPayment;
}): boolean => {
  const externalReferenceMatches =
    payment.externalReference === null ||
    payment.externalReference === order.externalId;
  const checkoutSessionMatches =
    payment.checkoutSession === null ||
    payment.checkoutSession === order.providerCheckoutId;
  const hasExactOrderReference =
    payment.externalReference === order.externalId ||
    payment.checkoutSession === order.providerCheckoutId;
  return (
    payment.id === order.providerPaymentId &&
    externalReferenceMatches &&
    checkoutSessionMatches &&
    hasExactOrderReference
  );
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
    `select id, course_id, user_id, external_id, buyer_identity_status,
            access_duration_months,
            provider_checkout_id,
            provider_payment_id, provider_installment_id,
            provider_payment_status, provider_risk_status, amount_in_cents, status
     from orders
     where id = $1 and provider = 'asaas'`,
    [orderId]
  );
  const order = readReconciliationOrder(initial.rows[0]);
  if (!order) {
    throw new Error("Pedido Asaas sem pagamento correlacionado.");
  }

  const payment = await getReconciliationPayment({ gateway, order });
  if (!hasExactPaymentCorrelation({ order, payment })) {
    throw new Error("A consulta Asaas nao corresponde ao Pedido informado.");
  }
  const preliminaryDecision = adaptQueriedPaymentDecision({ order, payment });
  const buyerIdentityPreparation = await prepareReconciliationBuyerIdentity({
    gateway,
    order,
    payment,
    shouldGrantAccess: preliminaryDecision.shouldGrantAccess,
  });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const locked = await client.query(
      `select id, course_id, user_id, external_id, buyer_identity_status,
              access_duration_months,
              provider_checkout_id,
              provider_payment_id, provider_installment_id,
              provider_payment_status, provider_risk_status, amount_in_cents, status
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

    const decision = adaptQueriedPaymentDecision({
      order: current,
      payment,
    });
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

    if (decision.shouldGrantAccess) {
      await applyReconciledConfirmedPayment({
        client,
        order: current,
        preparation: buyerIdentityPreparation,
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
      await closeRefundedBuyerIdentityReview({ client, now, orderId });
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

const startStatementImport = async ({
  actorUserId,
  finishDate,
  startDate,
}: {
  actorUserId: string;
  finishDate: string;
  startDate: string;
}): Promise<{ cursorKey: string; offset: number }> => {
  const cursorKey = `${startDate}:${finishDate}`;
  const { rows } = await getPool().query<{ next_offset: number }>(
    `
      insert into asaas_statement_import_cursors (
        range_key,
        start_date,
        finish_date,
        next_offset,
        status,
        started_by_user_id,
        completed_at
      )
      values ($1, $2, $3, 0, 'running', $4, null)
      on conflict (range_key) do update set
        next_offset = case
          when asaas_statement_import_cursors.status = 'completed' then 0
          else asaas_statement_import_cursors.next_offset
        end,
        status = 'running',
        started_by_user_id = excluded.started_by_user_id,
        completed_at = null,
        updated_at = now()
      returning next_offset
    `,
    [cursorKey, startDate, finishDate, actorUserId]
  );
  return { cursorKey, offset: rows[0]?.next_offset ?? 0 };
};

interface StatementPagePersistenceResult {
  inserted: number;
  updated: number;
}

const persistStatementPage = async ({
  actorUserId,
  completed,
  cursorKey,
  expectedOffset,
  nextOffset,
  previousInserted,
  previousUpdated,
  resumedFromOffset,
  transactions,
}: {
  actorUserId: string;
  completed: boolean;
  cursorKey: string;
  expectedOffset: number;
  nextOffset: number;
  previousInserted: number;
  previousUpdated: number;
  resumedFromOffset: number;
  transactions: AsaasFinancialTransaction[];
}): Promise<StatementPagePersistenceResult> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const cursor = await client.query<{ next_offset: number }>(
      `select next_offset
       from asaas_statement_import_cursors
       where range_key = $1 and status = 'running'
       for update`,
      [cursorKey]
    );
    if (cursor.rows[0]?.next_offset !== expectedOffset) {
      throw new Error("A importacao do extrato avancou em outra execucao.");
    }

    const serializedTransactions = transactions.map((transaction) => ({
      providerTransactionId: transaction.id,
      transactionDate: transaction.date,
      transactionType: transaction.type,
      valueInCents: transaction.valueInCents,
    }));
    const counts = await client.query<{ inserted: string; updated: string }>(
      `
        with incoming as (
          select *
          from jsonb_to_recordset($1::jsonb) as transaction (
            "providerTransactionId" text,
            "transactionDate" text,
            "transactionType" text,
            "valueInCents" integer
          )
        ), existing as (
          select transaction.provider_transaction_id
          from asaas_financial_transactions transaction
          join incoming on incoming."providerTransactionId" = transaction.provider_transaction_id
        ), upserted as (
          insert into asaas_financial_transactions (
            provider_transaction_id,
            transaction_date,
            transaction_type,
            value_in_cents
          )
          select
            "providerTransactionId",
            "transactionDate",
            "transactionType",
            "valueInCents"
          from incoming
          on conflict (provider_transaction_id) do update set
            transaction_date = excluded.transaction_date,
            transaction_type = excluded.transaction_type,
            value_in_cents = excluded.value_in_cents,
            updated_at = now()
          returning provider_transaction_id
        )
        select
          count(*) filter (where existing.provider_transaction_id is null)::text as inserted,
          count(*) filter (where existing.provider_transaction_id is not null)::text as updated
        from incoming
        left join existing
          on existing.provider_transaction_id = incoming."providerTransactionId"
        where (select count(*) from upserted) >= 0
      `,
      [JSON.stringify(serializedTransactions)]
    );
    await client.query(
      `update asaas_statement_import_cursors
       set next_offset = $2,
           status = $3,
           completed_at = case when $3 = 'completed' then now() else null end,
           updated_at = now()
       where range_key = $1`,
      [cursorKey, nextOffset, completed ? "completed" : "running"]
    );
    const pageInserted = Number(counts.rows[0]?.inserted ?? 0);
    const pageUpdated = Number(counts.rows[0]?.updated ?? 0);
    if (completed) {
      await client.query(
        `insert into audit_logs (
           actor_user_id,
           action,
           target_type,
           target_id,
           metadata
         )
         values (
           $1,
           'asaas.statement_imported',
           'asaas_statement',
           $2,
           jsonb_build_object(
             'inserted', $3,
             'updated', $4,
             'resumedFromOffset', $5
           )
         )`,
        [
          actorUserId,
          cursorKey,
          previousInserted + pageInserted,
          previousUpdated + pageUpdated,
          resumedFromOffset,
        ]
      );
    }
    await client.query("commit");
    return {
      inserted: pageInserted,
      updated: pageUpdated,
    };
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
}): Promise<FinancialStatementImportResult> => {
  const cursor = await startStatementImport({
    actorUserId,
    finishDate,
    startDate,
  });
  const resumedFromOffset = cursor.offset;
  let inserted = 0;
  let offset = cursor.offset;
  let updated = 0;
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
    const nextOffset = offset + page.limit;
    const persisted = await persistStatementPage({
      actorUserId,
      completed: !page.hasMore,
      cursorKey: cursor.cursorKey,
      expectedOffset: offset,
      nextOffset,
      previousInserted: inserted,
      previousUpdated: updated,
      resumedFromOffset,
      transactions: page.data,
    });
    inserted += persisted.inserted;
    updated += persisted.updated;
    if (!page.hasMore) {
      return { completed: true, inserted, resumedFromOffset, updated };
    }
    offset = nextOffset;
  }
  throw new Error("Extrato Asaas excedeu o limite seguro de paginacao.");
};
