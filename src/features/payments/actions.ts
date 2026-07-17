"use server";

import { redirect } from "next/navigation";
import { canMutateStudentExperience } from "@/features/courses/preview";
import {
  issueRefundConfirmation,
  requestFullRefund,
} from "@/features/payments/refunds";
import {
  createCourseCheckout,
  resolvePaymentReview,
  retryFailedAbacatePayWebhook,
} from "@/features/payments/server";
import { requirePermission } from "@/lib/auth-permissions";
import { requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const startCourseCheckoutAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("Apenas alunos podem iniciar checkout.");
  }

  const courseId = readString(formData, "courseId");

  if (!courseId) {
    throw new Error("Curso invalido.");
  }

  const { redirectUrl } = await createCourseCheckout({
    courseId,
    user: session.user,
  });

  redirect(redirectUrl as Parameters<typeof redirect>[0]);
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

export const resolvePaymentReviewAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("viewFinancials");
  const reviewId = readString(formData, "reviewId");
  const decision = readString(formData, "decision");

  if (!reviewId || (decision !== "approved" && decision !== "rejected")) {
    throw new Error("Decisao financeira invalida.");
  }

  await resolvePaymentReview({
    actorUserId: session.user.id,
    canResolveTerminalConflicts: session.role === "admin",
    decision,
    decisionReason: readString(formData, "decisionReason"),
    reviewId,
  });
};

export const retryFailedAbacatePayWebhookAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("retryWebhook");
  const webhookEventId = readString(formData, "webhookEventId");

  if (!webhookEventId) {
    throw new Error("Webhook invalido.");
  }

  await retryFailedAbacatePayWebhook({
    actorUserId: session.user.id,
    webhookEventId,
  });
};
