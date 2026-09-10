/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  confirmRefundPasswordAction: vi.fn(),
  requestFullRefundAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/payments/actions", () => dependencies);

import { RefundOperation } from "./financial-refund-operation";

describe("RefundOperation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.confirmRefundPasswordAction.mockReset();
    dependencies.requestFullRefundAction.mockReset();
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

  it("describes the refund as a two-step request and protects identity reviews", () => {
    act(() => {
      root.render(<RefundOperation identityReview orderId="order-1" />);
    });

    expect(container.textContent).toContain("Etapa 1 de 2: confirmar a senha");
    expect(container.textContent).toContain(
      "Nenhum acesso é liberado enquanto a revisão de identidade estiver pendente."
    );
    expect(container.textContent).not.toContain("O acesso permanece ativo");
    expect(
      container.querySelector('form[aria-labelledby="refund-step-one-order-1"]')
    ).not.toBeNull();
  });

  it("announces and focuses the order confirmation step after password confirmation", async () => {
    dependencies.confirmRefundPasswordAction.mockResolvedValue({
      confirmationToken: "confirmation-token",
    });

    act(() => {
      root.render(<RefundOperation orderId="order-1" />);
    });

    const form = container.querySelector("form");
    const passwordInput = container.querySelector<HTMLInputElement>(
      "input[name='password']"
    );
    expect(form).not.toBeNull();
    expect(passwordInput).not.toBeNull();

    if (!(form && passwordInput)) {
      throw new Error("Refund password form was not rendered.");
    }

    passwordInput.value = "current-password";
    await act(async () => {
      form.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(dependencies.confirmRefundPasswordAction).toHaveBeenCalledOnce();
    expect(container.textContent).toContain(
      "Senha confirmada. A etapa 2 de 2 está pronta para preenchimento."
    );
    expect(document.activeElement?.id).toBe("refund-order-order-1");
    expect(container.textContent).toContain(
      "Confirmar solicitação de reembolso"
    );
  });
});
