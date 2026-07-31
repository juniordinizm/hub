/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.restoreAllMocks();
  });

  const renderAvailableLink = (): void => {
    act(() => {
      root.render(
        <CoursePurchaseLink link={{ available: true, url: publicUrl }} />
      );
    });
  };

  it("shows the public URL in a labeled read-only input with a semantic copy button", () => {
    renderAvailableLink();

    const input = container.querySelector<HTMLInputElement>("input");
    const button = container.querySelector<HTMLButtonElement>("button");

    expect(input?.readOnly).toBe(true);
    expect(input?.value).toBe(publicUrl);
    expect(
      container.querySelector('label[for="course-purchase-link"]')
    ).not.toBeNull();
    expect(button?.type).toBe("button");
    expect(button?.textContent).toContain("Copiar");
  });

  it("copies the URL on demand and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderAvailableLink();

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(publicUrl);
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent
    ).toContain("Link copiado");
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
      container.querySelector<HTMLButtonElement>("button")?.click();
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe(publicUrl.length);
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent
    ).toContain("Ctrl+C");
  });

  it("explains an unavailable link without rendering a false URL", () => {
    act(() => {
      root.render(
        <CoursePurchaseLink
          link={{ available: false, reason: "course_unpublished" }}
        />
      );
    });

    expect(container.textContent).toContain("course_unpublished");
    expect(container.textContent).toContain("publicacao publicada");
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
