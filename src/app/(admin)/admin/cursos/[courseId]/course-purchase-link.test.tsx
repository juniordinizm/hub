/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

import { CoursePurchaseLink } from "./course-purchase-link";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const publicUrl = "https://hub.example/comprar/curso";

describe("CoursePurchaseLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(navigator, "clipboard");
    toastError.mockReset();
    toastSuccess.mockReset();
    vi.restoreAllMocks();
  });

  const renderAvailableLink = (): void => {
    act(() => {
      root.render(
        <CoursePurchaseLink
          link={{ available: true, url: publicUrl }}
          publicUrl={publicUrl}
        />
      );
    });
  };

  const clickCopyButton = (): void => {
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) {
      throw new Error("Expected purchase copy button.");
    }
    button.click();
  };

  it("exposes a direct copy action without rendering the URL or a checkout link", () => {
    renderAvailableLink();

    const button = container.querySelector<HTMLButtonElement>("button");

    expect(button?.textContent).toContain("Link público");
    expect(button?.type).toBe("button");
    expect(container.querySelector("input:not(.sr-only)")).toBeNull();
    expect(document.querySelector(`a[href="${publicUrl}"]`)).toBeNull();
  });

  it("copies the URL on demand and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderAvailableLink();

    await act(async () => {
      clickCopyButton();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(publicUrl);
    expect(toastSuccess).toHaveBeenCalledWith("Link público copiado.");
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
  });

  it.each([
    "missing",
    "rejected",
  ] as const)("selects and focuses the URL with accessible instructions when Clipboard API is %s", async (clipboardFailure) => {
    if (clipboardFailure === "rejected") {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      });
    }
    renderAvailableLink();
    const input = container.querySelector<HTMLInputElement>("input");

    await act(async () => {
      clickCopyButton();
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe(publicUrl.length);
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
    expect(toastError).toHaveBeenCalledWith(
      "Não foi possível copiar automaticamente. O link foi selecionado; pressione Ctrl+C para copiar."
    );
  });

  it("keeps the stable public link copyable while explaining closed checkout", () => {
    act(() => {
      root.render(
        <CoursePurchaseLink
          link={{ available: false, reason: "course_unpublished" }}
          publicUrl={publicUrl}
        />
      );
    });

    expect(container.textContent).toContain("Checkout público indisponível");
    expect(container.textContent).toContain("course_unpublished");
    expect(container.textContent).toContain("publicação publicada");
    expect(container.querySelector("input")?.getAttribute("value")).toBe(
      publicUrl
    );
    expect(container.querySelector("button")?.textContent).toContain(
      "Link público"
    );
  });
});
