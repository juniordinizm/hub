"use server";

import { requirePermission } from "@/lib/auth-permissions";
import {
  initiateLearningReengagement,
  resolveLearningReengagement,
} from "./server";

export const initiateLearningReengagementAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageLearningAnalytics");
  await initiateLearningReengagement({
    actorUserId: session.user.id,
    enrollmentId: String(formData.get("enrollmentId") ?? ""),
    intent: String(formData.get("intent") ?? ""),
  });
};

export const resolveLearningReengagementAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageLearningAnalytics");
  const status = String(formData.get("status") ?? "");
  if (
    !(status === "closed" || status === "opted_out" || status === "responded")
  ) {
    throw new Error("Estado de contato inválido.");
  }
  await resolveLearningReengagement({
    actorUserId: session.user.id,
    reengagementId: String(formData.get("reengagementId") ?? ""),
    result: String(formData.get("result") ?? ""),
    status,
  });
};
