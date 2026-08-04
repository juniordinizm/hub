/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ redirectToCheckout: vi.fn() }));
vi.mock("./checkout-navigation", () => navigation);

import { PurchaseFormClient } from "./purchase-form-client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const quote = {
  cardOptions: [
    {
      count: 1,
      grossAmountInCents: 10_000,
      installmentAmountInCents: 10_000,
      lastInstallmentAmountInCents: 10_000,
      surchargeAmountInCents: 0,
    },
    {
      count: 3,
      grossAmountInCents: 10_048,
      installmentAmountInCents: 3349,
      lastInstallmentAmountInCents: 3350,
      surchargeAmountInCents: 48,
    },
  ],
  expiresAt: "2099-08-03T15:30:00.000Z",
  installmentsTemporarilyUnavailable: false,
  pix: { grossAmountInCents: 10_000 },
  quoteId: "09d71750-87d5-48cf-9fe4-6c8ef6033369",
};

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  navigation.redirectToCheckout.mockReset();
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = async (): Promise<void> => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(quote), { status: 200 })
  );
  await act(async () => {
    root.render(
      <PurchaseFormClient
        courseSlug="curso-publico"
        courseTitle="Curso publico"
      />
    );
    await Promise.resolve();
  });
  await act(async () => await Promise.resolve());
};

describe("PurchaseFormClient", () => {
  it("collects identity and transparently displays totals without card data", async () => {
    await render();

    expect(container.querySelector('[name="name"]')).not.toBeNull();
    expect(container.querySelector('[name="email"]')).not.toBeNull();
    expect(container.querySelector('[name="cpfCnpj"]')).not.toBeNull();
    expect(container.querySelector('[name="cardNumber"]')).toBeNull();
    expect(container.textContent).toContain("3 parcelas de R$ 33,49");
    expect(container.textContent).toContain("ultima de R$ 33,50");
    expect(container.textContent).toContain("Total R$ 100,48");
    expect(container.textContent).toContain("acrescimo R$ 0,48");
  });

  it("posts the exact selected quote and redirects to the hosted invoice", async () => {
    await render();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orderId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
          redirectUrl: "https://sandbox.asaas.com/i/pay_asaas",
          status: "ready",
        }),
        { status: 200 }
      )
    );
    const setValue = (name: string, value: string): void => {
      const input = container.querySelector<HTMLInputElement>(
        `[name="${name}"]`
      );
      if (!input) {
        throw new Error(`missing ${name}`);
      }
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue("name", "Compradora");
    setValue("email", "buyer@example.com");
    setValue("cpfCnpj", "390.533.447-05");
    const installment = container.querySelector<HTMLInputElement>(
      '[value="credit_card:3"]'
    );
    await act(async () => installment?.click());
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const request = fetchMock.mock.calls[1];
    expect(request?.[0]).toBe("/api/purchases/course");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      courseSlug: "curso-publico",
      cpfCnpj: "390.533.447-05",
      email: "buyer@example.com",
      installmentCount: 3,
      paymentMethod: "credit_card",
      quoteId: quote.quoteId,
    });
    expect(navigation.redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/i/pay_asaas"
    );
  });

  it("recovers an uncertain creation before allowing another mutation", async () => {
    await render();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orderId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
            status: "processing",
          }),
          { status: 202 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orderId: "7fb3447e-2702-48f8-abe2-6c47b091bdcb",
            redirectUrl: "https://sandbox.asaas.com/i/pay_recovered",
            status: "ready",
          }),
          { status: 200 }
        )
      );
    for (const [name, value] of [
      ["name", "Compradora"],
      ["email", "buyer@example.com"],
      ["cpfCnpj", "390.533.447-05"],
    ] as const) {
      const input = container.querySelector<HTMLInputElement>(
        `[name="${name}"]`
      );
      if (!input) {
        throw new Error(`missing ${name}`);
      }
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      "/api/purchases/course?courseSlug=curso-publico&purchaseAttemptId="
    );
    expect(navigation.redirectToCheckout).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/i/pay_recovered"
    );
  });
});
