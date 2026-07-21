"use server";

import { requirePermission } from "@/lib/auth-permissions";
import { reprocessOutboxDeadLetter } from "./server";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const reprocessOutboxDeadLetterAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("retryOutbox");
  const messageId = readString(formData, "messageId");

  if (!messageId) {
    throw new Error("Mensagem da outbox invalida.");
  }

  await reprocessOutboxDeadLetter({
    actorUserId: session.user.id,
    messageId,
    reason: readString(formData, "reason"),
  });
};
