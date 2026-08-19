// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CertificateCopyLinkButton } from "./certificate-copy-link-button";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("CertificateCopyLinkButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  const renderButton = (): HTMLButtonElement => {
    act(() =>
      root.render(
        <CertificateCopyLinkButton publicUrl="https://certificates.example/certificados/CERT-001" />
      )
    );
    const button = container.querySelector("button");
    if (!button) {
      throw new Error("Copy button was not rendered.");
    }
    return button;
  };

  it("copies the canonical public URL and announces success", async () => {
    writeText.mockResolvedValue(undefined);
    const button = renderButton();

    await act(async () => button.click());

    expect(writeText).toHaveBeenCalledWith(
      "https://certificates.example/certificados/CERT-001"
    );
    expect(button.textContent).toContain("Link copiado");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Link copiado."
    );
  });

  it("announces clipboard errors without losing the retry action", async () => {
    writeText.mockRejectedValue(new Error("clipboard denied"));
    const button = renderButton();

    await act(async () => button.click());

    expect(button.textContent).toContain("Copiar link");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Não foi possível copiar o link. Tente novamente."
    );
  });
});
