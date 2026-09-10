/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FinanceHelp } from "./finance-help";

describe("FinanceHelp", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("offers a keyboard-accessible help button and opens detailed guidance", () => {
    act(() => {
      root.render(
        <FinanceHelp
          description="Resumo simples"
          details={["Explicação detalhada"]}
          title="Uma seção"
        />
      );
    });

    const button = container.querySelector(
      'button[aria-label="Ajuda: Uma seção"]'
    );
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-size")).toBe("icon-sm");
    expect(button?.className).toContain("after:-inset-1");
    expect(button?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("Ajuda: Uma seção");
    expect(document.body.textContent).toContain("Explicação detalhada");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button?.getAttribute("aria-expanded")).toBe("true");
  });
});
