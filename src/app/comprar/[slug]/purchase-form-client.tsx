"use client";

import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redirectToCheckout } from "./checkout-navigation";

interface PublicCardOption {
  count: number;
  grossAmountInCents: number;
  installmentAmountInCents: number;
  lastInstallmentAmountInCents: number;
  surchargeAmountInCents: number;
}

interface PublicQuote {
  cardOptions: PublicCardOption[];
  expiresAt: string;
  installmentsTemporarilyUnavailable: boolean;
  pix: { grossAmountInCents: number } | null;
  quoteId: string;
}

type Selection =
  | { installmentCount: 1; paymentMethod: "pix" }
  | { installmentCount: number; paymentMethod: "credit_card" };

const PURCHASE_ENDPOINT = "/api/purchases/course";
const ATTEMPT_STORAGE_PREFIX = "hub:invoice-attempt:v1:";
const ATTEMPT_TTL_MS = 60 * 60 * 1000;
const RECOVERY_ATTEMPTS = 4;
const RECOVERY_DELAY_MS = 1500;

const currency = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const formatCurrency = (valueInCents: number): string =>
  currency.format(valueInCents / 100).replaceAll("\u00a0", " ");

const parseQuote = (value: unknown): PublicQuote | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Partial<PublicQuote>;
  const isMoney = (amount: unknown): amount is number =>
    Number.isSafeInteger(amount) && Number(amount) >= 0;
  const isCardOption = (option: unknown): option is PublicCardOption => {
    if (typeof option !== "object" || option === null) {
      return false;
    }
    const card = option as Partial<PublicCardOption>;
    return (
      Number.isSafeInteger(card.count) &&
      Number(card.count) >= 1 &&
      Number(card.count) <= 12 &&
      isMoney(card.grossAmountInCents) &&
      isMoney(card.installmentAmountInCents) &&
      isMoney(card.lastInstallmentAmountInCents) &&
      isMoney(card.surchargeAmountInCents)
    );
  };
  return Array.isArray(candidate.cardOptions) &&
    candidate.cardOptions.every(isCardOption) &&
    typeof candidate.expiresAt === "string" &&
    Number.isFinite(Date.parse(candidate.expiresAt)) &&
    typeof candidate.quoteId === "string" &&
    typeof candidate.installmentsTemporarilyUnavailable === "boolean" &&
    (candidate.pix === null ||
      (typeof candidate.pix === "object" &&
        candidate.pix !== null &&
        isMoney(candidate.pix.grossAmountInCents)))
    ? (candidate as PublicQuote)
    : null;
};

const describeCardOption = (option: PublicCardOption): string => {
  if (option.count === 1) {
    return `1x de ${formatCurrency(option.grossAmountInCents)} sem acrescimo`;
  }
  const installments =
    option.installmentAmountInCents === option.lastInstallmentAmountInCents
      ? `${option.count} parcelas de ${formatCurrency(option.installmentAmountInCents)}`
      : `${option.count} parcelas de ${formatCurrency(option.installmentAmountInCents)}, ultima de ${formatCurrency(option.lastInstallmentAmountInCents)}`;
  return `${installments}. Total ${formatCurrency(option.grossAmountInCents)}; acrescimo ${formatCurrency(option.surchargeAmountInCents)}`;
};

const getAttemptId = (courseSlug: string): string => {
  const key = `${ATTEMPT_STORAGE_PREFIX}${courseSlug}`;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "id" in parsed &&
        typeof parsed.id === "string" &&
        "createdAt" in parsed &&
        typeof parsed.createdAt === "number" &&
        Date.now() - parsed.createdAt < ATTEMPT_TTL_MS
      ) {
        return parsed.id;
      }
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(
      key,
      JSON.stringify({ createdAt: Date.now(), id: created })
    );
    return created;
  } catch {
    const created = crypto.randomUUID();
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({ createdAt: Date.now(), id: created })
      );
    } catch {
      // Storage is optional; the in-flight request still remains idempotent.
    }
    return created;
  }
};

const clearAttemptId = (courseSlug: string): void => {
  try {
    window.localStorage.removeItem(`${ATTEMPT_STORAGE_PREFIX}${courseSlug}`);
  } catch {
    // A blocked storage API must not prevent a new purchase attempt.
  }
};

type PurchaseResult =
  | { orderId: string; redirectUrl: string; status: "ready" }
  | { orderId: string; status: "failed" | "processing" | "unavailable" };

const parsePurchaseResult = (value: unknown): PurchaseResult | null => {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return null;
  }
  const result = value as Record<string, unknown>;
  if (result.status === "ready") {
    return typeof result.orderId === "string" &&
      typeof result.redirectUrl === "string"
      ? {
          orderId: result.orderId,
          redirectUrl: result.redirectUrl,
          status: "ready",
        }
      : null;
  }
  return (result.status === "failed" ||
    result.status === "processing" ||
    result.status === "unavailable") &&
    typeof result.orderId === "string"
    ? { orderId: result.orderId, status: result.status }
    : null;
};

const waitForRecovery = async ({
  courseSlug,
  purchaseAttemptId,
}: {
  courseSlug: string;
  purchaseAttemptId: string;
}): Promise<PurchaseResult | null> => {
  const parameters = new URLSearchParams({ courseSlug, purchaseAttemptId });
  for (let attempt = 0; attempt < RECOVERY_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${PURCHASE_ENDPOINT}?${parameters}`, {
      method: "GET",
    });
    const result = parsePurchaseResult(await response.json().catch(() => null));
    if (result?.status !== "processing") {
      return result;
    }
    if (attempt < RECOVERY_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, RECOVERY_DELAY_MS));
    }
  }
  return null;
};

const getInitialSelection = (quote: PublicQuote): Selection | null => {
  if (quote.pix) {
    return { installmentCount: 1, paymentMethod: "pix" };
  }
  const firstCardOption = quote.cardOptions[0];
  return firstCardOption
    ? {
        installmentCount: firstCardOption.count,
        paymentMethod: "credit_card",
      }
    : null;
};

const getPurchaseErrorMessage = (result: PurchaseResult | null): string => {
  if (result === null || result.status === "processing") {
    return "O pagamento ainda esta sendo preparado. Tente continuar novamente em instantes.";
  }
  return "Nao foi possivel preparar o pagamento. Tente novamente.";
};

export function PurchaseFormClient({
  buyer,
  courseSlug,
  courseTitle,
}: {
  buyer?: { email: string; name: string };
  courseSlug: string;
  courseTitle: string;
}): React.JSX.Element {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const quoteUrl = useMemo(() => {
    const parameters = new URLSearchParams({ courseSlug });
    return `${PURCHASE_ENDPOINT}/quote?${parameters.toString()}`;
  }, [courseSlug]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(quoteUrl, { method: "GET", signal: controller.signal })
      .then(async (response) => parseQuote(await response.json()))
      .then((result) => {
        if (!result) {
          setError("Cotacao indisponivel. Tente novamente.");
          return;
        }
        setQuote(result);
        setSelection(getInitialSelection(result));
      })
      .catch((fetchError: unknown) => {
        if (
          !(
            fetchError instanceof DOMException &&
            fetchError.name === "AbortError"
          )
        ) {
          setError("Cotacao indisponivel. Tente novamente.");
        }
      });
    return () => controller.abort();
  }, [quoteUrl]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(quote && selection) || new Date(quote.expiresAt) <= new Date()) {
      setError("A cotacao expirou. Recarregue a pagina.");
      return;
    }
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const purchaseAttemptId = getAttemptId(courseSlug);
      const response = await fetch(PURCHASE_ENDPOINT, {
        body: JSON.stringify({
          courseSlug,
          cpfCnpj: String(data.get("cpfCnpj") ?? ""),
          email: buyer?.email ?? String(data.get("email") ?? ""),
          installmentCount: selection.installmentCount,
          name: buyer?.name ?? String(data.get("name") ?? ""),
          paymentMethod: selection.paymentMethod,
          purchaseAttemptId,
          quoteId: quote.quoteId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      let result = parsePurchaseResult(await response.json().catch(() => null));
      if (result?.status === "processing") {
        result = await waitForRecovery({ courseSlug, purchaseAttemptId });
      }
      if (result?.status === "ready") {
        redirectToCheckout(result.redirectUrl);
        return;
      }
      if (result?.status === "failed") {
        clearAttemptId(courseSlug);
      }
      setError(getPurchaseErrorMessage(result));
    } catch {
      setError("Nao foi possivel preparar o pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">{courseTitle}</h1>
        {quote || error ? null : <p className="mt-3">Calculando opcoes...</p>}
        {quote ? (
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2" htmlFor="purchase-name">
                <span className="text-sm">Nome completo</span>
                <Input
                  defaultValue={buyer?.name}
                  id="purchase-name"
                  name="name"
                  readOnly={Boolean(buyer)}
                  required
                />
              </label>
              <label className="space-y-2" htmlFor="purchase-email">
                <span className="text-sm">E-mail</span>
                <Input
                  defaultValue={buyer?.email}
                  id="purchase-email"
                  name="email"
                  readOnly={Boolean(buyer)}
                  required
                  type="email"
                />
              </label>
            </div>
            <label className="block space-y-2" htmlFor="purchase-tax-id">
              <span className="text-sm">CPF ou CNPJ</span>
              <Input
                id="purchase-tax-id"
                inputMode="numeric"
                name="cpfCnpj"
                required
              />
            </label>
            <fieldset className="space-y-3">
              <legend className="font-medium">Forma de pagamento</legend>
              {quote.pix ? (
                <label className="flex gap-3 rounded-lg border p-3">
                  <input
                    checked={selection?.paymentMethod === "pix"}
                    name="paymentOption"
                    onChange={() =>
                      setSelection({
                        installmentCount: 1,
                        paymentMethod: "pix",
                      })
                    }
                    type="radio"
                    value="pix:1"
                  />
                  Pix. Total {formatCurrency(quote.pix.grossAmountInCents)}
                </label>
              ) : null}
              {quote.cardOptions.map((option) => (
                <label
                  className="flex gap-3 rounded-lg border p-3"
                  key={option.count}
                >
                  <input
                    checked={
                      selection?.paymentMethod === "credit_card" &&
                      selection.installmentCount === option.count
                    }
                    name="paymentOption"
                    onChange={() =>
                      setSelection({
                        installmentCount: option.count,
                        paymentMethod: "credit_card",
                      })
                    }
                    type="radio"
                    value={`credit_card:${option.count}`}
                  />
                  Cartao: {describeCardOption(option)}
                </label>
              ))}
            </fieldset>
            {quote.installmentsTemporarilyUnavailable ? (
              <p className="text-amber-700 text-sm">
                Parcelas adicionais estao temporariamente indisponiveis.
              </p>
            ) : null}
            {error ? (
              <p aria-live="polite" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <Button disabled={submitting || !selection} type="submit">
              {submitting
                ? "Preparando pagamento..."
                : "Continuar para pagamento seguro"}
            </Button>
            <p className="text-muted-foreground text-xs">
              Os dados do cartao serao informados somente na Fatura segura do
              Asaas.
            </p>
          </form>
        ) : null}
        {!quote && error ? (
          <p aria-live="polite" className="mt-3 text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </section>
    </PageContainer>
  );
}
