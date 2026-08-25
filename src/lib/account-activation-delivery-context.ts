import { AsyncLocalStorage } from "node:async_hooks";
import type { HostedEmailDeliveryContext } from "@/features/email/server";

type AccountActivationDeliveryOutcome = "delivered" | "failed" | "pending";

interface AccountActivationDeliveryState {
  emailDeliveryContext?: HostedEmailDeliveryContext;
  idempotencyKey: string;
  outcome: AccountActivationDeliveryOutcome;
}

interface AccountActivationDeliveryContext {
  emailDeliveryContext?: HostedEmailDeliveryContext;
  recordDelivered: () => void;
  recordFailed: () => void;
}

const accountActivationDeliveryStorage =
  new AsyncLocalStorage<AccountActivationDeliveryState>();

export const runWithAccountActivationDeliveryContext = async ({
  idempotencyKey,
  emailDeliveryContext,
  operation,
}: {
  idempotencyKey: string;
  emailDeliveryContext?: HostedEmailDeliveryContext;
  operation: () => Promise<void>;
}): Promise<boolean> => {
  const state: AccountActivationDeliveryState = {
    idempotencyKey,
    ...(emailDeliveryContext ? { emailDeliveryContext } : {}),
    outcome: "pending",
  };
  await accountActivationDeliveryStorage.run(state, operation);
  return state.outcome === "delivered";
};

export const getAccountActivationDeliveryContext = (
  idempotencyKey: string
): AccountActivationDeliveryContext | undefined => {
  const state = accountActivationDeliveryStorage.getStore();
  if (!state || state.idempotencyKey !== idempotencyKey) {
    return;
  }
  return {
    ...(state.emailDeliveryContext
      ? { emailDeliveryContext: state.emailDeliveryContext }
      : {}),
    recordDelivered: () => {
      if (state.outcome === "pending") {
        state.outcome = "delivered";
      }
    },
    recordFailed: () => {
      state.outcome = "failed";
    },
  };
};
