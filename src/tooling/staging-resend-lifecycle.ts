export interface StagingResendLifecycleEvidence {
  correlationId: string;
  deliveryEventConflict: boolean;
  eventStatuses: string[];
  eventTypes: string[];
  lastErrorCode: string | null;
  messageStatus: string;
}

interface StagingResendLifecycleDependencies {
  delay: () => Promise<void>;
  hasControlledAccount: () => Promise<boolean>;
  readEvidence: () => Promise<StagingResendLifecycleEvidence | null>;
  requestPasswordReset: () => Promise<number>;
  runWebhookWorker: () => Promise<number>;
}

const REQUIRED_EVENT_TYPES = new Set(["email.delivered", "email.sent"]);
const TERMINAL_EVENT_STATUS = "processed";

export const isCompleteStagingResendLifecycle = (
  evidence: StagingResendLifecycleEvidence
): boolean =>
  evidence.messageStatus === "delivered" &&
  evidence.lastErrorCode === null &&
  !evidence.deliveryEventConflict &&
  [...REQUIRED_EVENT_TYPES].every((eventType) =>
    evidence.eventTypes.includes(eventType)
  ) &&
  evidence.eventStatuses.length >= REQUIRED_EVENT_TYPES.size &&
  evidence.eventStatuses.every((status) => status === TERMINAL_EVENT_STATUS);

export const verifyStagingResendLifecycle = async ({
  attempts,
  dependencies,
}: {
  attempts: number;
  dependencies: StagingResendLifecycleDependencies;
}): Promise<StagingResendLifecycleEvidence> => {
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error("Staging Resend lifecycle attempts must be positive.");
  }
  if (!(await dependencies.hasControlledAccount())) {
    throw new Error("Controlled Staging account is not available.");
  }

  const resetStatus = await dependencies.requestPasswordReset();
  if (resetStatus < 200 || resetStatus >= 300) {
    throw new Error("Staging password reset request failed.");
  }

  let lastEvidence: StagingResendLifecycleEvidence | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const workerStatus = await dependencies.runWebhookWorker();
    if (workerStatus < 200 || workerStatus >= 300) {
      throw new Error("Staging Resend webhook worker failed.");
    }
    lastEvidence = await dependencies.readEvidence();
    if (lastEvidence && isCompleteStagingResendLifecycle(lastEvidence)) {
      return lastEvidence;
    }
    if (attempt < attempts) {
      await dependencies.delay();
    }
  }

  throw new Error(
    `Staging Resend lifecycle did not converge: ${JSON.stringify({
      deliveryEventConflict: lastEvidence?.deliveryEventConflict ?? null,
      eventStatuses: lastEvidence?.eventStatuses ?? [],
      eventTypes: lastEvidence?.eventTypes ?? [],
      lastErrorCode: lastEvidence?.lastErrorCode ?? null,
      messageStatus: lastEvidence?.messageStatus ?? null,
    })}.`
  );
};
