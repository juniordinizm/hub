import { AsaasGatewayError } from "./asaas-client";

const MAX_QUERY_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 500;

type Sleep = (durationMs: number) => Promise<void>;

const sleep: Sleep = async (durationMs) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

let queryTail = Promise.resolve();

const acquireQuerySlot = async (): Promise<() => void> => {
  const previous = queryTail;
  let release = (): void => undefined;
  queryTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
};

const getBackoffMs = ({
  attempt,
  error,
}: {
  attempt: number;
  error: AsaasGatewayError;
}): number =>
  Math.min(
    error.retryAfterMs ?? INITIAL_BACKOFF_MS * 2 ** attempt,
    MAX_BACKOFF_MS
  );

export const runCoordinatedAsaasQuery = async <Result>({
  operation,
  wait = sleep,
}: {
  operation: () => Promise<Result>;
  wait?: Sleep;
}): Promise<Result> => {
  const release = await acquireQuerySlot();
  try {
    for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const shouldRetry =
          error instanceof AsaasGatewayError &&
          error.kind === "rate_limited" &&
          error.retryable &&
          attempt < MAX_QUERY_ATTEMPTS - 1;
        if (!shouldRetry) {
          throw error;
        }
        await wait(getBackoffMs({ attempt, error }));
      }
    }
    throw new Error("Consulta Asaas excedeu as tentativas permitidas.");
  } finally {
    release();
  }
};
