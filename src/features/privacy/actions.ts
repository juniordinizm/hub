"use server";

import {
  approvePrivacyRequest,
  executePrivacyAnonymization,
  registerPrivacyRequest,
} from "@/features/privacy/server";
import { requirePermission } from "@/lib/auth-permissions";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const registerPrivacyRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("managePrivacyRequests");
  await registerPrivacyRequest({
    actorUserId: session.user.id,
    reason: readString(formData, "reason"),
    userId: readString(formData, "userId"),
  });
};

export const approvePrivacyRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("executePrivacyAnonymization");
  await approvePrivacyRequest({
    actorUserId: session.user.id,
    requestId: readString(formData, "requestId"),
  });
};

export const executePrivacyAnonymizationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("executePrivacyAnonymization");
  await executePrivacyAnonymization({
    actorUserId: session.user.id,
    requestId: readString(formData, "requestId"),
  });
};
