"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  type ContentReleaseScheduleSnapshot,
  hasDelayedModules,
} from "@/features/courses/module-content-release";
import { redirectToCheckout } from "./checkout-navigation";

type HandoffState =
  | { kind: "starting" }
  | { kind: "review" }
  | { kind: "processing"; manualCheck: boolean; orderId: string }
  | { kind: "retry"; replaceAttempt: boolean }
  | { kind: "schedule_changed" }
  | { kind: "unavailable" };

type CheckoutResponse =
  | {
      orderId: string;
      redirectUrl: string;
      retryAllowed: false;
      status: "ready";
    }
  | { orderId: string; retryAllowed: false; status: "processing" }
  | { orderId: string; retryAllowed: true; status: "failed" }
  | {
      error: string;
      retryAllowed: false;
      status: "unavailable";
    }
  | { retryAllowed: false; status: "schedule_changed" };

type CheckoutOutcome = HandoffState | { kind: "redirect"; redirectUrl: string };

const CHECKOUT_ENDPOINT = "/api/checkouts/course";
// Bump this namespace when a provider account is rotated. Old storage keys
// point to immutable checkout URLs and must not be reused after the cutover.
const ATTEMPT_STORAGE_PREFIX = "hub:checkout-attempt:v3:";
const ATTEMPT_VALUE_PREFIX = "v1:";
const SHARED_ATTEMPT_VALUE_PREFIX = "v2:";
const ATTEMPT_TTL_MS = 60 * 60 * 1000;
const STATUS_POLL_DELAYS_MS = [1000, 2000, 4000, 8000, 16_000] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const decodeStoredAttempt = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (value.startsWith(SHARED_ATTEMPT_VALUE_PREFIX)) {
    const [, expiresAtValue, attemptId] = value.split(":");
    const expiresAt = Number(expiresAtValue);
    return Number.isSafeInteger(expiresAt) &&
      expiresAt > Date.now() &&
      attemptId &&
      UUID_PATTERN.test(attemptId)
      ? attemptId
      : null;
  }

  const attemptId = value.startsWith(ATTEMPT_VALUE_PREFIX)
    ? value.slice(ATTEMPT_VALUE_PREFIX.length)
    : value;
  return UUID_PATTERN.test(attemptId) ? attemptId : null;
};

const readAttempt = (key: string, fallback: string | null): string | null => {
  try {
    const sharedAttempt = decodeStoredAttempt(window.localStorage.getItem(key));
    if (sharedAttempt) {
      return sharedAttempt;
    }
  } catch {
    // Session storage and the in-memory ref remain available fallbacks.
  }
  try {
    return decodeStoredAttempt(window.sessionStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const storeAttempt = (key: string, attemptId: string): void => {
  const value = `${SHARED_ATTEMPT_VALUE_PREFIX}${Date.now() + ATTEMPT_TTL_MS}:${attemptId}`;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Session storage and the in-memory ref remain available fallbacks.
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // The in-memory ref remains the safe fallback for this mount.
  }
};

const removeAttempt = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // The session and in-memory values are still replaced below.
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // A replacement still occurs in the in-memory ref.
  }
};

const parseCheckoutResponse = (value: unknown): CheckoutResponse | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const response = value as Record<string, unknown>;
  if (
    response.status === "ready" &&
    typeof response.orderId === "string" &&
    typeof response.redirectUrl === "string" &&
    response.retryAllowed === false
  ) {
    return {
      orderId: response.orderId,
      redirectUrl: response.redirectUrl,
      retryAllowed: false,
      status: "ready",
    };
  }

  if (
    response.status === "processing" &&
    typeof response.orderId === "string" &&
    response.retryAllowed === false
  ) {
    return {
      orderId: response.orderId,
      retryAllowed: false,
      status: "processing",
    };
  }

  if (
    response.status === "failed" &&
    typeof response.orderId === "string" &&
    response.retryAllowed === true
  ) {
    return {
      orderId: response.orderId,
      retryAllowed: true,
      status: "failed",
    };
  }

  if (
    response.status === "unavailable" &&
    typeof response.error === "string" &&
    response.retryAllowed === false
  ) {
    return {
      error: response.error,
      retryAllowed: false,
      status: "unavailable",
    };
  }

  return null;
};

const readCheckoutResponse = async (
  response: Response
): Promise<CheckoutResponse | null> => {
  try {
    const value: unknown = await response.json();
    return parseCheckoutResponse(value);
  } catch {
    return null;
  }
};

const getCheckoutOutcome = (
  response: CheckoutResponse | null
): CheckoutOutcome => {
  if (!response) {
    return { kind: "retry", replaceAttempt: false };
  }

  switch (response.status) {
    case "ready":
      return { kind: "redirect", redirectUrl: response.redirectUrl };
    case "processing":
      return {
        kind: "processing",
        manualCheck: false,
        orderId: response.orderId,
      };
    case "failed":
      return { kind: "retry", replaceAttempt: true };
    case "schedule_changed":
      return { kind: "schedule_changed" };
    case "unavailable":
      return { kind: "unavailable" };
    default:
      return { kind: "retry", replaceAttempt: false };
  }
};

export function PurchaseHandoffClient({
  courseSlug,
  courseTitle,
  releaseSchedule,
  releaseScheduleDigest,
}: {
  courseSlug: string;
  courseTitle: string;
  releaseSchedule: ContentReleaseScheduleSnapshot;
  releaseScheduleDigest: string;
}): React.JSX.Element {
  const [state, setState] = useState<HandoffState>(() =>
    hasDelayedModules(releaseSchedule)
      ? { kind: "review" }
      : { kind: "starting" }
  );
  const initialRequestStarted = useRef(false);
  const mounted = useRef(false);
  const memoryAttempt = useRef<string | null>(null);
  const processingOrderId = useRef<string | null>(null);
  const pollIndex = useRef(0);
  const pollStatus = useRef<(attemptId: string) => Promise<void>>(async () => {
    // Assigned during render before any timer can run.
  });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `${ATTEMPT_STORAGE_PREFIX}${courseSlug}`;

  const setMountedState = useCallback((nextState: HandoffState): void => {
    if (mounted.current) {
      setState(nextState);
    }
  }, []);

  const clearPollTimer = useCallback((): void => {
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const scheduleStatusPoll = useCallback(
    (attemptId: string, orderId: string): void => {
      clearPollTimer();
      const delay = STATUS_POLL_DELAYS_MS[pollIndex.current];
      if (delay === undefined) {
        setMountedState({ kind: "processing", manualCheck: true, orderId });
        return;
      }

      pollIndex.current += 1;
      pollTimer.current = setTimeout(() => {
        pollTimer.current = null;
        pollStatus.current(attemptId).catch(() => {
          setMountedState({ kind: "processing", manualCheck: true, orderId });
        });
      }, delay);
    },
    [clearPollTimer, setMountedState]
  );

  const applyCheckoutOutcome = useCallback(
    (attemptId: string, outcome: CheckoutOutcome): void => {
      if (outcome.kind === "redirect") {
        clearPollTimer();
        try {
          redirectToCheckout(outcome.redirectUrl);
        } catch {
          setMountedState({ kind: "unavailable" });
        }
        return;
      }

      if (outcome.kind === "processing") {
        processingOrderId.current = outcome.orderId;
        setMountedState({ ...outcome, manualCheck: false });
        scheduleStatusPoll(attemptId, outcome.orderId);
        return;
      }

      clearPollTimer();
      setMountedState(outcome);
    },
    [clearPollTimer, scheduleStatusPoll, setMountedState]
  );

  const checkCheckoutStatus = useCallback(
    async (attemptId: string): Promise<void> => {
      let response: Response;
      try {
        const query = new URLSearchParams({
          checkoutAttemptId: attemptId,
          courseSlug,
        });
        response = await fetch(`${CHECKOUT_ENDPOINT}?${query.toString()}`, {
          method: "GET",
        });
      } catch {
        setMountedState({
          kind: "processing",
          manualCheck: true,
          orderId: processingOrderId.current ?? attemptId,
        });
        return;
      }

      const result = await readCheckoutResponse(response);
      if (!mounted.current) {
        return;
      }
      if (!result) {
        setMountedState({
          kind: "processing",
          manualCheck: true,
          orderId: processingOrderId.current ?? attemptId,
        });
        return;
      }
      applyCheckoutOutcome(attemptId, getCheckoutOutcome(result));
    },
    [applyCheckoutOutcome, courseSlug, setMountedState]
  );
  pollStatus.current = checkCheckoutStatus;

  const startCheckout = useCallback(
    async (replaceAttempt: boolean): Promise<void> => {
      clearPollTimer();
      pollIndex.current = 0;
      setState({ kind: "starting" });

      if (replaceAttempt) {
        memoryAttempt.current = null;
        removeAttempt(storageKey);
      }

      const existingAttempt = replaceAttempt
        ? null
        : readAttempt(storageKey, memoryAttempt.current);
      const checkoutAttemptId = existingAttempt ?? crypto.randomUUID();
      memoryAttempt.current = checkoutAttemptId;
      storeAttempt(storageKey, checkoutAttemptId);

      let response: Response;
      try {
        response = await fetch(CHECKOUT_ENDPOINT, {
          body: JSON.stringify({
            checkoutAttemptId,
            courseSlug,
            expectedContentReleaseScheduleDigest: releaseScheduleDigest,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      } catch {
        setMountedState({ kind: "retry", replaceAttempt: false });
        return;
      }

      const result = await readCheckoutResponse(response);
      if (!mounted.current) {
        return;
      }

      const outcome = getCheckoutOutcome(result);
      applyCheckoutOutcome(checkoutAttemptId, outcome);
    },
    [
      applyCheckoutOutcome,
      clearPollTimer,
      courseSlug,
      releaseScheduleDigest,
      setMountedState,
      storageKey,
    ]
  );

  useEffect(() => {
    mounted.current = true;
    if (initialRequestStarted.current) {
      return () => {
        mounted.current = false;
      };
    }
    initialRequestStarted.current = true;
    if (hasDelayedModules(releaseSchedule)) {
      return () => {
        mounted.current = false;
        clearPollTimer();
      };
    }
    startCheckout(false).catch(() => {
      setMountedState({ kind: "unavailable" });
    });
    return () => {
      mounted.current = false;
      clearPollTimer();
    };
  }, [clearPollTimer, releaseSchedule, setMountedState, startCheckout]);

  const handleRetry = async (): Promise<void> => {
    if (state.kind === "retry") {
      await startCheckout(state.replaceAttempt);
    }
  };

  const handleManualCheck = async (): Promise<void> => {
    const attemptId = readAttempt(storageKey, memoryAttempt.current);
    if (!(state.kind === "processing" && attemptId)) {
      return;
    }
    pollIndex.current = 0;
    setMountedState({ ...state, manualCheck: false });
    await checkCheckoutStatus(attemptId);
  };

  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <section
        aria-live="polite"
        className="max-w-2xl rounded-lg border bg-card p-6"
      >
        <h1 className="font-bold text-2xl tracking-tight">{courseTitle}</h1>
        <section
          aria-labelledby="purchase-release-schedule-heading"
          className="mt-6 rounded-md border bg-background/50 p-4"
        >
          <h2
            className="font-semibold text-base"
            id="purchase-release-schedule-heading"
          >
            Cronograma de liberação
          </h2>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Parte do conteúdo é liberada progressivamente. Cada dia equivale a
            24 horas desde o início do seu acesso.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
            {releaseSchedule.modules.map((module) => (
              <li key={`${module.sortOrder}-${module.title}`}>
                <span className="font-medium">{module.title}</span> —{" "}
                {module.releaseDelayDays === 0
                  ? "imediato"
                  : `após ${module.releaseDelayDays} dias`}
              </li>
            ))}
          </ol>
        </section>
        {state.kind === "review" ? (
          <div className="mt-6 space-y-4">
            <p className="text-muted-foreground text-sm">
              Revise o cronograma antes de continuar para o pagamento.
            </p>
            <Button onClick={() => startCheckout(false)} type="button">
              Continuar para pagamento
            </Button>
          </div>
        ) : null}
        {state.kind === "starting" ? (
          <p className="mt-3 text-muted-foreground text-sm">
            Iniciando checkout seguro...
          </p>
        ) : null}
        {state.kind === "processing" ? (
          <div className="mt-3 space-y-2 text-muted-foreground text-sm">
            <p>O checkout esta sendo preparado. Nao inicie outra tentativa.</p>
            <p>Referencia do pedido: {state.orderId}</p>
            {state.manualCheck ? (
              <Button onClick={handleManualCheck} type="button">
                Verificar novamente
              </Button>
            ) : null}
          </div>
        ) : null}
        {state.kind === "retry" ? (
          <div className="mt-3 space-y-4">
            <p className="text-muted-foreground text-sm">
              Nao foi possivel iniciar o checkout.
            </p>
            <Button onClick={handleRetry} type="button">
              Tentar novamente
            </Button>
          </div>
        ) : null}
        {state.kind === "unavailable" ? (
          <p className="mt-3 text-muted-foreground text-sm">
            Checkout indisponivel. Entre em contato com o suporte.
          </p>
        ) : null}
        {state.kind === "schedule_changed" ? (
          <div className="mt-6 space-y-4">
            <p className="text-muted-foreground text-sm">
              O cronograma foi atualizado. Recarregue para revisar antes de
              continuar.
            </p>
            <Button onClick={() => window.location.reload()} type="button">
              Recarregar página
            </Button>
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
