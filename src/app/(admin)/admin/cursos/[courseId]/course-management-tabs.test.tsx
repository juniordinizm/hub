/**
 * @vitest-environment jsdom
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { CourseManagementTabs } from "./course-management-tabs";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const StatefulCertificate = (): React.JSX.Element => {
  const [count, setCount] = useState(0);

  return (
    <button
      data-certificate-state="true"
      onClick={() => setCount(count + 1)}
      type="button"
    >
      Certificado {count}
    </button>
  );
};

describe("CourseManagementTabs", () => {
  let container: HTMLDivElement;
  let root: Root;
  const scrollIntoView = vi.fn();

  const renderTabs = (): void => {
    act(() => {
      root.render(
        <CourseManagementTabs
          certificate={<StatefulCertificate />}
          content={<p>Painel de conteúdo</p>}
          overview={<p>Painel de visão geral</p>}
          settings={<p>Painel de configurações</p>}
          students={<p>Painel de alunos</p>}
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

  const clickTab = (name: string): void => {
    act(() => {
      const tab = getTab(name);
      tab.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          cancelable: true,
        })
      );
      tab.click();
    });
    renderTabs();
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(
      null,
      "",
      "/admin/cursos/course-1?source=dashboard#course-tabs"
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    scrollIntoView.mockClear();
  });

  it("activates a valid tab from the URL", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/cursos/course-1?tab=content&source=dashboard"
    );

    renderTabs();

    expect(getTab("Conteúdo").getAttribute("data-state")).toBe("active");
    expect(container.textContent).toContain("Painel de conteúdo");
  });

  it("falls back to overview for an invalid URL tab", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/cursos/course-1?tab=unknown&source=dashboard"
    );

    renderTabs();

    expect(getTab("Visão geral").getAttribute("data-state")).toBe("active");
    expect(container.textContent).toContain("Painel de visão geral");
  });

  it("sets certificate in the URL while preserving other params and hash", () => {
    renderTabs();

    clickTab("Certificado");

    expect(window.location.pathname).toBe("/admin/cursos/course-1");
    expect(window.location.search).toBe("?source=dashboard&tab=certificate");
    expect(window.location.hash).toBe("#course-tabs");
  });

  it("removes only tab when returning to overview", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/cursos/course-1?source=dashboard&tab=settings#course-tabs"
    );
    renderTabs();

    clickTab("Visão geral");

    expect(window.location.search).toBe("?source=dashboard");
    expect(window.location.hash).toBe("#course-tabs");
  });

  it("reflects the current URL after browser history navigation", () => {
    renderTabs();
    clickTab("Conteúdo");

    window.history.pushState(
      null,
      "",
      "/admin/cursos/course-1?source=dashboard&tab=students#course-tabs"
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    renderTabs();

    expect(getTab("Alunos").getAttribute("data-state")).toBe("active");
  });

  it("keeps certificate state mounted and hides its inactive panel", () => {
    renderTabs();

    const certificateButton = container.querySelector<HTMLButtonElement>(
      '[data-certificate-state="true"]'
    );
    const certificatePanel = certificateButton?.closest<HTMLElement>(
      '[data-slot="tabs-content"]'
    );

    expect(certificateButton).not.toBeNull();
    expect(certificatePanel?.getAttribute("data-state")).toBe("inactive");
    expect(certificatePanel?.className).toContain(
      "data-[state=inactive]:hidden"
    );

    clickTab("Certificado");
    act(() => certificateButton?.click());
    expect(certificateButton?.textContent).toBe("Certificado 1");

    clickTab("Conteúdo");
    expect(container.querySelector('[data-certificate-state="true"]')).toBe(
      certificateButton
    );
    expect(certificatePanel?.getAttribute("data-state")).toBe("inactive");

    clickTab("Certificado");
    expect(container.querySelector('[data-certificate-state="true"]')).toBe(
      certificateButton
    );
    expect(certificateButton?.textContent).toBe("Certificado 1");
  });

  it("renders all five navigation options in one non-wrapping strip", () => {
    renderTabs();

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect(
      container.querySelector("[data-course-tabs-scroll]")?.className
    ).toContain("overflow-x-auto");
    expect(container.querySelector('[role="tablist"]')?.className).toContain(
      "flex-nowrap"
    );
  });

  it("keeps the active tab visible after URL-driven navigation", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/cursos/course-1?tab=certificate"
    );

    renderTabs();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
    });
  });
});
