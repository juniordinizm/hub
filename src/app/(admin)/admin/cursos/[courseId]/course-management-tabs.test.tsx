/**
 * @vitest-environment jsdom
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  routerPush: vi.fn((url: string) => {
    window.history.pushState(null, "", url);
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: dependencies.routerPush }),
}));

import {
  CourseManagementTabs,
  useCourseTabDirty,
} from "./course-management-tabs";

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

const DirtySettingsControls = (): React.JSX.Element => {
  const [firstDirty, setFirstDirty] = useState(false);
  const [secondDirty, setSecondDirty] = useState(false);
  useCourseTabDirty("settings", firstDirty);
  useCourseTabDirty("settings", secondDirty);

  return (
    <div>
      <button
        onClick={() => setFirstDirty((current) => !current)}
        type="button"
      >
        Alternar primeiro
      </button>
      <button
        onClick={() => setSecondDirty((current) => !current)}
        type="button"
      >
        Alternar segundo
      </button>
    </div>
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

  const renderDirtyTabs = (): void => {
    act(() => {
      root.render(
        <CourseManagementTabs
          certificate={<p>Painel de certificado</p>}
          content={<p>Painel de conteúdo</p>}
          overview={<p>Painel de visão geral</p>}
          settings={<DirtySettingsControls />}
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
    dispatchTabClick(name);
    renderTabs();
  };

  const dispatchTabClick = (name: string): void => {
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
    dependencies.routerPush.mockClear();
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

  it("mounts only the selected panel", () => {
    renderTabs();

    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-certificate-state="true"]'
      )
    ).toBeNull();

    clickTab("Certificado");
    const certificateButton = container.querySelector<HTMLButtonElement>(
      '[data-certificate-state="true"]'
    );

    expect(certificateButton).not.toBeNull();
    act(() => certificateButton?.click());
    expect(certificateButton?.textContent).toBe("Certificado 1");

    clickTab("Conteúdo");
    expect(container.querySelector('[data-certificate-state="true"]')).toBe(
      null
    );
  });

  it("keeps the tab guard while another settings form remains dirty", () => {
    renderDirtyTabs();
    dispatchTabClick("Configurações");
    renderDirtyTabs();

    act(() => {
      const first = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Alternar primeiro"
      );
      first?.click();
    });
    act(() => {
      const second = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Alternar segundo"
      );
      second?.click();
    });
    act(() => {
      const first = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Alternar primeiro"
      );
      first?.click();
    });

    dispatchTabClick("Conteúdo");

    expect(document.body.textContent).toContain("Alterações não salvas");
    expect(document.body.textContent).toContain("Continuar editando");
  });

  it("guards internal links and browser unload while settings are dirty", () => {
    renderDirtyTabs();
    dispatchTabClick("Configurações");
    renderDirtyTabs();

    act(() => {
      const first = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Alternar primeiro"
      );
      first?.click();
    });

    const link = document.createElement("a");
    link.href = "/admin/financeiro";
    link.textContent = "Ir para o financeiro";
    container.append(link);
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      button: 0,
      cancelable: true,
    });

    act(() => {
      link.dispatchEvent(clickEvent);
    });

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(document.body.textContent).toContain("Alterações não salvas");

    const unloadEvent = new Event("beforeunload", {
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(unloadEvent);
    });

    expect(unloadEvent.defaultPrevented).toBe(true);
  });

  it("guards browser history navigation while settings are dirty", () => {
    renderDirtyTabs();
    dispatchTabClick("Configurações");
    renderDirtyTabs();

    act(() => {
      const first = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Alternar primeiro"
      );
      first?.click();
    });

    window.history.pushState(null, "", "/admin/cursos/course-1?source=history");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(window.location.search).toBe("?source=dashboard&tab=settings");
    expect(document.body.textContent).toContain("Alterações não salvas");
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
