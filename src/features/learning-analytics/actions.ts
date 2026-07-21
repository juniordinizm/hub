"use server";

import { requirePermission } from "@/lib/auth-permissions";
import { initiateLearningReengagement } from "./server";

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
