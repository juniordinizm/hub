"use server";

import {
  parsePrivacyRequestIdentifierInput,
  parseRegisterPrivacyRequestInput,
} from "@/features/privacy/command-input";
import {
  approvePrivacyRequest,
  executePrivacyAnonymization,
  registerPrivacyRequest,
} from "@/features/privacy/server";
import { requirePermission } from "@/lib/auth-permissions";

export const registerPrivacyRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("managePrivacyRequests");
  const input = parseRegisterPrivacyRequestInput(formData);
  await registerPrivacyRequest({
    actorUserId: session.user.id,
    ...input,
  });
};

export const approvePrivacyRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("executePrivacyAnonymization");
  const input = parsePrivacyRequestIdentifierInput(formData);
  await approvePrivacyRequest({
    actorUserId: session.user.id,
    ...input,
  });
};

export const executePrivacyAnonymizationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("executePrivacyAnonymization");
  const input = parsePrivacyRequestIdentifierInput(formData);
  await executePrivacyAnonymization({
    actorUserId: session.user.id,
    ...input,
  });
};
