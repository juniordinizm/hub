/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => navigation,
}));

import { FinancialTabs } from "./financial-tabs";

describe("FinancialTabs", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderTabs = (): void => {
    act(() => {
      root.render(
        <FinancialTabs
          analysis={<p>Análise por período</p>}
          orders={<p>Painel de pedidos</p>}
          overview={<p>Painel geral</p>}
        />
      );
    });
  };

  const getTab = (name: string): HTMLButtonElement => {
    const tab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    ).find((candidate) => candidate.textContent === name);

    if (!tab) {
      throw new Error(`Expected tab: ${name}`);
    }

    return tab;
  };

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    navigation.push.mockReset();
    window.history.replaceState(
      null,
      "",
      "/admin/financeiro?q=Student&status=paid#financeiro"
    );
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

  it("falls back to the general tab and renders both destinations", () => {
    renderTabs();

    expect(getTab("Visão geral").getAttribute("data-state")).toBe("active");
    expect(container.textContent).toContain("Painel geral");
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(
      container.querySelector('[role="tablist"]')?.getAttribute("aria-label")
    ).toBe("Seções do financeiro");
  });

  it("activates the orders tab from the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/financeiro?tab=orders&q=Student&status=paid"
    );
    renderTabs();

    expect(getTab("Pedidos").getAttribute("data-state")).toBe("active");
    expect(container.textContent).toContain("Painel de pedidos");
  });

  it("activates the analysis tab from the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/financeiro?tab=analysis&period=30d"
    );
    renderTabs();

    expect(getTab("Análises").getAttribute("data-state")).toBe("active");
    expect(container.textContent).toContain("Análise por período");
  });

  it("starts the orders section with only its owned query state", () => {
    renderTabs();

    act(() => {
      const tab = getTab("Pedidos");
      tab.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          cancelable: true,
        })
      );
      tab.click();
    });
    expect(navigation.push).toHaveBeenCalledWith(
      "/admin/financeiro?q=Student&status=paid&tab=orders#financeiro"
    );

    window.history.replaceState(
      null,
      "",
      "/admin/financeiro?tab=orders&q=Student&status=paid#financeiro"
    );
    renderTabs();
    act(() => {
      const tab = getTab("Visão geral");
      tab.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          cancelable: true,
        })
      );
      tab.click();
    });
    expect(navigation.push).toHaveBeenLastCalledWith(
      "/admin/financeiro#financeiro"
    );
  });

  it("does not carry invisible tab-specific state into another section", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/financeiro?tab=analysis&period=30d#financeiro"
    );
    renderTabs();

    act(() => {
      const tab = getTab("Visão geral");
      tab.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          cancelable: true,
        })
      );
      tab.click();
    });

    expect(navigation.push).toHaveBeenLastCalledWith(
      "/admin/financeiro#financeiro"
    );
  });
});
