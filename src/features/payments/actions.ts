"use server";

import { redirect } from "next/navigation";
import { requeueFailedAsaasWebhook } from "@/features/payments/asaas-webhook-worker";
import {
  createAsaasCheckoutIntent,
  createCheckoutCallbacks,
} from "@/features/payments/checkout";
import { assertCheckoutAvailable } from "@/features/payments/checkout-availability";
import { resolvePaymentReview } from "@/features/payments/payment-reviews";
import {
  getApplicationUrl,
  getAsaasProviderClient,
} from "@/features/payments/provider";
import {
  type FinancialStatementImportResult,
  importAsaasFinancialStatement,
  reconcileAsaasPayment,
} from "@/features/payments/reconciliation";
import {
  issueRefundConfirmation,
  requestFullRefund,
} from "@/features/payments/refunds";
import { requirePermission } from "@/lib/auth-permissions";
import { getServerEnv } from "@/lib/env";
import { requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const startCourseCheckoutAction = async (
  formData: FormData
): Promise<void> => {
  assertCheckoutAvailable({
    entry: "authenticated",
    mode: getServerEnv().PAYMENTS_CHECKOUT_MODE,
  });
  const session = await requireSession();

  if (session.role !== "student") {
    throw new Error("Apenas alunos podem iniciar checkout.");
  }

  const courseId = readString(formData, "courseId");
  const checkoutAttemptId = readString(formData, "checkoutAttemptId");

  if (!(courseId && checkoutAttemptId)) {
    throw new Error("Curso invalido.");
  }

  const callbacks = createCheckoutCallbacks(checkoutAttemptId);
  const checkout = await createAsaasCheckoutIntent({
    attemptId: checkoutAttemptId,
    buyer: {
      email: session.user.email,
      kind: "authenticated",
      name: session.user.name,
      userId: session.user.id,
    },
    callbacks: {
      ...callbacks,
      successUrl: getApplicationUrl(
        `/app/checkout/sucesso?courseId=${encodeURIComponent(courseId)}`
      ),
    },
    courseId,
    gateway: getAsaasProviderClient(),
  });

  if (checkout.status === "failed") {
    throw new Error("Nao foi possivel iniciar o checkout.");
  }

  const destination =
    checkout.status === "ready"
      ? checkout.redirectUrl
      : `/app/checkout/sucesso?courseId=${encodeURIComponent(courseId)}`;
  redirect(destination as Parameters<typeof redirect>[0]);
};

export const confirmRefundPasswordAction = async (
  formData: FormData
): Promise<{ confirmationToken: string }> => {
  const session = await requirePermission("executeRefund");
  const orderId = readString(formData, "orderId");

  if (!orderId) {
    throw new Error("Pedido invalido.");
  }

  return await issueRefundConfirmation({
    actorUserId: session.user.id,
    orderId,
    password: readString(formData, "password"),
  });
};

export const requestFullRefundAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("executeRefund");
  const orderId = readString(formData, "orderId");

  if (!orderId) {
    throw new Error("Pedido invalido.");
  }

  await requestFullRefund({
    actorUserId: session.user.id,
    confirmationToken: readString(formData, "confirmationToken"),
    orderId,
    reason: readString(formData, "reason"),
    typedOrderId: readString(formData, "typedOrderId"),
  });
};

export const reconcileAsaasPaymentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageFinancialOperations");
  const orderId = readString(formData, "orderId");
  if (!orderId) {
    throw new Error("Pedido invalido.");
  }
  await reconcileAsaasPayment({
    actorUserId: session.user.id,
    orderId,
  });
};

export const importAsaasStatementAction = async (
  formData: FormData
): Promise<FinancialStatementImportResult> => {
  const session = await requirePermission("manageFinancialOperations");
  const startDate = readString(formData, "startDate");
  const finishDate = readString(formData, "finishDate");
  if (!(ISO_DATE_RE.test(startDate) && ISO_DATE_RE.test(finishDate))) {
    throw new Error("Periodo do extrato invalido.");
  }
  if (startDate > finishDate) {
    throw new Error("A data inicial deve anteceder a data final.");
  }
  return await importAsaasFinancialStatement({
    actorUserId: session.user.id,
    finishDate,
    startDate,
  });
};

export const resolvePaymentReviewAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageFinancialReviews");
  const reviewId = readString(formData, "reviewId");
  const decision = readString(formData, "decision");

  if (!reviewId || (decision !== "approved" && decision !== "rejected")) {
    throw new Error("Decisao financeira invalida.");
  }

  await resolvePaymentReview({
    actorUserId: session.user.id,
    decision,
    decisionReason: readString(formData, "decisionReason"),
    reviewId,
  });
};

export const retryFailedAsaasWebhookAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("retryWebhook");
  const webhookEventId = readString(formData, "webhookEventId");

  if (!webhookEventId) {
    throw new Error("Webhook invalido.");
  }

  await requeueFailedAsaasWebhook({
    actorUserId: session.user.id,
    eventId: webhookEventId,
    reason: readString(formData, "reason"),
  });
};
