import { AsyncLocalStorage } from "node:async_hooks";

type AccountActivationDeliveryOutcome = "delivered" | "failed" | "pending";

interface AccountActivationDeliveryState {
  idempotencyKey: string;
  outcome: AccountActivationDeliveryOutcome;
}

interface AccountActivationDeliveryContext {
  recordDelivered: () => void;
  recordFailed: () => void;
}

const accountActivationDeliveryStorage =
  new AsyncLocalStorage<AccountActivationDeliveryState>();

export const runWithAccountActivationDeliveryContext = async ({
  idempotencyKey,
  operation,
}: {
  idempotencyKey: string;
  operation: () => Promise<void>;
}): Promise<boolean> => {
  const state: AccountActivationDeliveryState = {
    idempotencyKey,
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
