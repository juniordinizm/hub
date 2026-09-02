"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  parseChangeCertificateInput,
  parseIssueManualCertificateInput,
  parseReconcileHistoricalCertificatesInput,
} from "@/features/certificates/command-input";
import {
  issueManualCertificate,
  reconcileHistoricalCourseCertificates,
  reissueCertificate,
  revokeCertificate,
} from "@/features/certificates/server";
import { scheduleOutboxDrainAfterResponse } from "@/features/outbox/background-drain";
import { requirePermission } from "@/lib/auth-permissions";
import { requireRole } from "@/lib/session";
import type { CertificateActionState } from "./action-state";
import { CertificateDomainError } from "./errors";

const getExpectedCertificateActionMessage = (error: unknown): string | null => {
  if (error instanceof CertificateDomainError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Revise os dados informados.";
  }
  return null;
};

const runCertificateAction = async ({
  operation,
  successMessage,
}: {
  operation: () => Promise<void>;
  successMessage: string;
}): Promise<CertificateActionState> => {
  try {
    await operation();
    return { message: successMessage, status: "success" };
  } catch (error) {
    const message = getExpectedCertificateActionMessage(error);
    if (!message) {
      throw error;
    }
    return { message, status: "error" };
  }
};

export const issueManualCertificateAction = async (
  _previousState: CertificateActionState,
  formData: FormData
): Promise<CertificateActionState> =>
  runCertificateAction({
    operation: async () => {
      const session = await requirePermission("manageCertificates");
      const { confirmed: _confirmed, ...input } =
        parseIssueManualCertificateInput(formData);
      await issueManualCertificate({
        actorUserId: session.user.id,
        ...input,
      });
      scheduleOutboxDrainAfterResponse();
    },
    successMessage: "Certificado emitido.",
  });

export const revokeCertificateAction = async (
  _previousState: CertificateActionState,
  formData: FormData
): Promise<CertificateActionState> =>
  runCertificateAction({
    operation: async () => {
      const session = await requirePermission("manageCertificates");
      const { confirmed: _confirmed, ...input } =
        parseChangeCertificateInput(formData);
      await revokeCertificate({
        actorUserId: session.user.id,
        ...input,
      });
    },
    successMessage: "Certificado revogado.",
  });

export const reissueCertificateAction = async (
  _previousState: CertificateActionState,
  formData: FormData
): Promise<CertificateActionState> =>
  runCertificateAction({
    operation: async () => {
      const session = await requirePermission("reissueCertificates");
      if (session.role === "student") {
        throw new Error("Certificate permission invariant violated.");
      }
      const { confirmed: _confirmed, ...input } =
        parseChangeCertificateInput(formData);
      await reissueCertificate({
        actorRole: session.role,
        actorUserId: session.user.id,
        ...input,
      });
      scheduleOutboxDrainAfterResponse();
    },
    successMessage: "Certificado reemitido.",
  });

export type CertificateReconciliationActionResult =
  | {
      issued: number;
      message: string;
      remaining: number;
      status: "success";
    }
  | { message: string; status: "error" };

export const reconcileHistoricalCertificatesAction = async (
  formData: FormData
): Promise<CertificateReconciliationActionResult> => {
  try {
    const session = await requireRole(["admin"]);
    const { courseId } = parseReconcileHistoricalCertificatesInput(formData);
    const result = await reconcileHistoricalCourseCertificates({
      actorUserId: session.user.id,
      courseId,
    });
    scheduleOutboxDrainAfterResponse({ aggregateId: courseId });
    revalidatePath(`/admin/cursos/${courseId}`);
    return {
      ...result,
      message: `${result.issued} certificados enviados para geracao. Restam ${result.remaining}.`,
      status: "success",
    };
  } catch (error) {
    const message = getExpectedCertificateActionMessage(error);
    if (!message) {
      throw error;
    }
    return { message, status: "error" };
  }
};
