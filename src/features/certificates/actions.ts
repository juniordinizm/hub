"use server";

import {
  issueManualCertificate,
  reissueCertificate,
  revokeCertificate,
} from "@/features/certificates/server";
import { requirePermission } from "@/lib/auth-permissions";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const issueManualCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  await issueManualCertificate({
    actorUserId: session.user.id,
    courseId: readString(formData, "courseId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
    userId: readString(formData, "userId"),
  });
};

export const revokeCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  await revokeCertificate({
    actorUserId: session.user.id,
    certificateId: readString(formData, "certificateId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
  });
};

export const reissueCertificateAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageCertificates");
  await reissueCertificate({
    actorUserId: session.user.id,
    certificateId: readString(formData, "certificateId"),
    reasonCategory: readString(formData, "reasonCategory"),
    reasonDetail: readString(formData, "reasonDetail"),
  });
};
