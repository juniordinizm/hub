/**
 * @vitest-environment jsdom
 */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirectToCheckout: vi.fn(),
}));

vi.mock("./checkout-navigation", () => ({
  redirectToCheckout: navigation.redirectToCheckout,
}));

import type { ContentReleaseScheduleSnapshot } from "@/features/courses/module-content-release";
import { PurchaseHandoffClient } from "./purchase-handoff-client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FIRST_ATTEMPT = "11111111-1111-4111-8111-111111111111";
const SECOND_ATTEMPT = "22222222-2222-4222-8222-222222222222";
const STORAGE_KEY = "hub:checkout-attempt:v3:curso-publico";
const LEGACY_STORAGE_KEY = "hub:checkout-attempt:curso-publico";
const RELEASE_SCHEDULE = {
  clock: "elapsed_24h" as const,
  modules: [],
  version: 1 as const,
};
const RELEASE_DIGEST = "a".repeat(64);

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

const response = (body: unknown): Response =>
  ({
    json: vi.fn().mockResolvedValue(body),
    ok: true,
  }) as unknown as Response;

const renderHandoff = ({
  releaseSchedule = RELEASE_SCHEDULE,
  releaseScheduleDigest = RELEASE_DIGEST,
  strict = false,
}: {
  releaseSchedule?: ContentReleaseScheduleSnapshot;
  releaseScheduleDigest?: string;
  strict?: boolean;
} = {}): void => {
  act(() => {
    root.render(
      strict ? (
        <StrictMode>
          <PurchaseHandoffClient
            courseSlug="curso-publico"
            courseTitle="Curso publico"
            releaseSchedule={releaseSchedule}
            releaseScheduleDigest={releaseScheduleDigest}
          />
        </StrictMode>
      ) : (
        <PurchaseHandoffClient
          courseSlug="curso-publico"
          courseTitle="Curso publico"
          releaseSchedule={releaseSchedule}
          releaseScheduleDigest={releaseScheduleDigest}
        />
      )
    );
  });
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const clickRetry = async (): Promise<void> => {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === "Tentar novamente"
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
  await flushEffects();
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  navigation.redirectToCheckout.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(globalThis.crypto, "randomUUID")
    .mockReturnValueOnce(FIRST_ATTEMPT)
    .mockReturnValueOnce(SECOND_ATTEMPT);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PurchaseHandoffClient", () => {
  it("shows a delayed schedule and waits for explicit payment confirmation", async () => {
    const releaseSchedule = {
      clock: "elapsed_24h" as const,
      modules: [
        { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
        { releaseDelayDays: 8, sortOrder: 2, title: "Aplicacao" },
      ],
      version: 1 as const,
    };
    const releaseScheduleDigest = "b".repeat(64);
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-review",
        redirectUrl: "https://sandbox.asaas.com/c/review",
        retryAllowed: false,
        status: "ready",
      })
    );

    await renderHandoff({ releaseSchedule, releaseScheduleDigest });
    await flushEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Aplicacao");
    expect(container.textContent).toContain("após 8 dias");
    const continueButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "Continuar para pagamento");
    expect(continueButton).toBeDefined();
    await act(async () => continueButton?.click());
    await flushEffects();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    ).toMatchObject({
      expectedContentReleaseScheduleDigest: releaseScheduleDigest,
    });
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.example/checkout",
    "https://sandbox.asaas.com.evil.example/checkout",
    "https://user:password@sandbox.asaas.com/checkout",
    "https://sandbox.asaas.com:443/checkout",
    "https://sandbox.asaas.com:444/checkout",
  ])("rejeita redirect inseguro %s", async (url) => {
    const actualNavigation = await vi.importActual<
      typeof import("./checkout-navigation")
    >("./checkout-navigation");

    expect(() => actualNavigation.redirectToCheckout(url)).toThrow(
      "Checkout redirect URL is not allowed."
    );
  });

  it.each([
    "https://sandbox.asaas.com/checkoutSession/show/11111111-1111-4111-8111-111111111111",
    "https://www.asaas.com/checkout/11111111-1111-4111-8111-111111111111",
    "https://asaas.com/checkout/11111111-1111-4111-8111-111111111111",
  ])("aceita redirect oficial %s", async (url) => {
    const actualNavigation = await vi.importActual<
      typeof import("./checkout-navigation")
    >("./checkout-navigation");

    expect(actualNavigation.isAllowedCheckoutUrl(url)).toBe(true);
  });

  it("redireciona uma unica vez quando o checkout fica pronto", async () => {
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        redirectUrl: "https://sandbox.asaas.com/c/checkout",
        retryAllowed: false,
        status: "ready",
      })
    );

    await renderHandoff({ strict: true });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/checkouts/course", {
      body: JSON.stringify({
        checkoutAttemptId: FIRST_ATTEMPT,
        courseSlug: "curso-publico",
        expectedContentReleaseScheduleDigest: RELEASE_DIGEST,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toMatch(
      new RegExp(`^v2:\\d+:${FIRST_ATTEMPT}$`)
    );
    expect(navigation.redirectToCheckout).toHaveBeenCalledTimes(1);
    expect(navigation.redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/c/checkout"
    );
  });

  it("converte redirect rejeitado em indisponibilidade segura", async () => {
    navigation.redirectToCheckout.mockImplementationOnce(() => {
      throw new Error("Checkout redirect URL is not allowed.");
    });
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        redirectUrl: "https://evil.example/checkout",
        retryAllowed: false,
        status: "ready",
      })
    );

    await renderHandoff();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Checkout indisponivel");
    expect(container.textContent).not.toContain("evil.example");
  });

  it("ignora resposta tardia depois do unmount", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    await renderHandoff();
    act(() => root.unmount());
    root = createRoot(container);

    await act(async () => {
      resolveResponse?.(
        response({
          orderId: "order-1",
          redirectUrl: "https://sandbox.asaas.com/c/checkout",
          retryAllowed: false,
          status: "ready",
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigation.redirectToCheckout).not.toHaveBeenCalled();
  });

  it("faz um unico POST com body exato, inclusive em Strict Mode", async () => {
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff({ strict: true });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/checkouts/course", {
      body: JSON.stringify({
        checkoutAttemptId: FIRST_ATTEMPT,
        courseSlug: "curso-publico",
        expectedContentReleaseScheduleDigest: RELEASE_DIGEST,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(sessionStorage.getItem(STORAGE_KEY)).toMatch(
      new RegExp(`^v2:\\d+:${FIRST_ATTEMPT}$`)
    );
    expect(container.textContent).toContain("order-1");
    expect(container.textContent).toContain("Nao inicie outra tentativa");
  });

  it("consulta a mesma tentativa ate o checkout em processamento ficar pronto", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        response({
          orderId: "order-1",
          retryAllowed: false,
          status: "processing",
        })
      )
      .mockResolvedValueOnce(
        response({
          orderId: "order-1",
          redirectUrl: "https://sandbox.asaas.com/c/checkout",
          retryAllowed: false,
          status: "ready",
        })
      );

    await renderHandoff();
    await flushEffects();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/checkouts/course?checkoutAttemptId=${FIRST_ATTEMPT}&courseSlug=curso-publico`,
      { method: "GET" }
    );
    expect(navigation.redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/c/checkout"
    );
  });

  it("encerra o polling e permite verificacao manual sem um segundo POST", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();
    for (const delay of [1000, 2000, 4000, 8000, 16_000]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
      await flushEffects();
    }

    const manualButton = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Verificar novamente"
    );
    expect(manualButton).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(6);

    await act(async () => manualButton?.click());
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(
      fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/checkouts/course?checkoutAttemptId=${FIRST_ATTEMPT}&courseSlug=curso-publico`,
      { method: "GET" }
    );
  });

  it("cancela a consulta pendente no unmount", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reusa a tentativa estavel da sessao", async () => {
    sessionStorage.setItem(STORAGE_KEY, FIRST_ATTEMPT);
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      checkoutAttemptId: FIRST_ATTEMPT,
      courseSlug: "curso-publico",
      expectedContentReleaseScheduleDigest: RELEASE_DIGEST,
    });
    expect(globalThis.crypto.randomUUID).not.toHaveBeenCalled();
  });

  it("nao reutiliza tentativa gravada antes da troca da conta Asaas", async () => {
    sessionStorage.setItem(LEGACY_STORAGE_KEY, FIRST_ATTEMPT);
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-2",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
    expect(sessionStorage.getItem(STORAGE_KEY)).toMatch(
      new RegExp(`^v2:\\d+:${FIRST_ATTEMPT}$`)
    );
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledOnce();
  });

  it("reusa entre abas a tentativa ainda valida sem criar outro checkout", async () => {
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-1",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff({ strict: true });
    await flushEffects();
    act(() => root.unmount());
    root = createRoot(container);
    sessionStorage.clear();

    await renderHandoff({ strict: true });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const attempts = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String((call[1] as RequestInit).body)).checkoutAttemptId
    );
    expect(attempts).toEqual([FIRST_ATTEMPT, FIRST_ATTEMPT]);
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("substitui uma tentativa compartilhada expirada", async () => {
    localStorage.setItem(STORAGE_KEY, `v2:1:${SECOND_ATTEMPT}`);
    fetchMock.mockResolvedValue(
      response({
        orderId: "order-2",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();

    const checkoutRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(checkoutRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledOnce();
  });

  it("mantem a tentativa apos erro de rede e so repete no clique", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(
      response({
        orderId: "order-2",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")?.textContent).toBe(
      "Tentar novamente"
    );

    await flushEffects();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await clickRetry();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(retryRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
  });

  it("troca a tentativa quando o backend permite retry e so repete no clique", async () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    fetchMock
      .mockResolvedValueOnce(
        response({ orderId: "order-1", retryAllowed: true, status: "failed" })
      )
      .mockResolvedValueOnce(
        response({
          orderId: "order-2",
          retryAllowed: false,
          status: "processing",
        })
      );

    await renderHandoff();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await clickRetry();

    const retryRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(retryRequest.body)).checkoutAttemptId).toBe(
      SECOND_ATTEMPT
    );
    expect(sessionStorage.getItem(STORAGE_KEY)).toMatch(
      new RegExp(`^v2:\\d+:${SECOND_ATTEMPT}$`)
    );
  });

  it("mostra indisponibilidade sem retry automatico", async () => {
    fetchMock.mockResolvedValue(
      response({
        error: "Servico indisponivel.",
        retryAllowed: false,
        status: "unavailable",
      })
    );

    await renderHandoff();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Entre em contato com o suporte");
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it.each([
    [
      "JSON malformado",
      () =>
        ({
          json: vi.fn().mockRejectedValue(new Error("invalid json")),
          ok: true,
        }) as unknown as Response,
    ],
    ["shape invalido", () => response({ redirectUrl: 42, status: "ready" })],
  ])("mantem a tentativa e exige retry manual para %s", async (_label, createInvalidResponse) => {
    fetchMock
      .mockResolvedValueOnce(createInvalidResponse())
      .mockResolvedValueOnce(
        response({
          orderId: "order-2",
          retryAllowed: false,
          status: "processing",
        })
      );

    await renderHandoff();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")?.textContent).toBe(
      "Tentar novamente"
    );
    await flushEffects();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await clickRetry();
    const retryRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(retryRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
  });

  it("usa fallback seguro quando sessionStorage falha", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(
      response({
        orderId: "order-2",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();
    await clickRetry();

    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const retryRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(firstRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
    expect(JSON.parse(String(retryRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
  });

  it("preserva a tentativa quando apenas a gravacao no storage falha", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(
      response({
        orderId: "order-2",
        retryAllowed: false,
        status: "processing",
      })
    );

    await renderHandoff();
    await flushEffects();
    await clickRetry();

    const retryRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(retryRequest.body)).checkoutAttemptId).toBe(
      FIRST_ATTEMPT
    );
  });
});
