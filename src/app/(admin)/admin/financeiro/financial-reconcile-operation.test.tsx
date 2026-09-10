/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  reconcileAsaasPaymentAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => dependencies);

import { ReconcilePaymentOperation } from "./financial-reconcile-operation";

describe("ReconcilePaymentOperation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.reconcileAsaasPaymentAction.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps the order and review correlation in the guarded action", () => {
    act(() => {
      root.render(
        <ReconcilePaymentOperation orderId="order-1" reviewId="review-1" />
      );
    });

    expect(
      container.querySelector('input[name="orderId"]')?.getAttribute("value")
    ).toBe("order-1");
    expect(
      container.querySelector('input[name="reviewId"]')?.getAttribute("value")
    ).toBe("review-1");
  });

  it("keeps the accessible result inline after a successful consultation", async () => {
    dependencies.reconcileAsaasPaymentAction.mockResolvedValue(undefined);

    act(() => {
      root.render(<ReconcilePaymentOperation orderId="order-1" />);
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    if (!form) {
      throw new Error("Reconciliation form was not rendered.");
    }

    await act(async () => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(dependencies.reconcileAsaasPaymentAction).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "O Pedido foi atualizado quando a evidência coincidiu"
    );
  });
});
