"use server";

import {
  parseChangeCertificateInput,
  parseIssueManualCertificateInput,
} from "@/features/certificates/command-input";
import {
  issueManualCertificate,
  reissueCertificate,
  revokeCertificate,
} from "@/features/certificates/server";
import { requirePermission } from "@/lib/auth-permissions";

export const issueManualCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  const input = parseIssueManualCertificateInput(formData);
  await issueManualCertificate({
    actorUserId: session.user.id,
    ...input,
  });
};

export const revokeCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  const input = parseChangeCertificateInput(formData);
  await revokeCertificate({
    actorUserId: session.user.id,
    ...input,
  });
};

export const reissueCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  const input = parseChangeCertificateInput(formData);
  await reissueCertificate({
    actorUserId: session.user.id,
    ...input,
  });
};
