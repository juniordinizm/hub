/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn(),
  getPasswordResetRedirectUrl: vi.fn(),
}));
const SPAM_PATTERN = /pasta de spam/i;

vi.mock("@/lib/auth-policy", () => ({
  getPasswordResetRedirectUrl: dependencies.getPasswordResetRedirectUrl,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { RequestPasswordResetForm } from "./request-password-reset-form";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const getForm = (container: HTMLDivElement): HTMLFormElement => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected the request form to be rendered.");
  }
  return form;
};

const getButton = (
  container: HTMLDivElement,
  label: string
): HTMLButtonElement => {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) {
    throw new Error(`Expected button ${label} to be rendered.`);
  }
  return button;
};

const fillValidEmail = (container: HTMLDivElement): void => {
  const email = container.querySelector<HTMLInputElement>("#email");
  if (!email) {
    throw new Error("Expected the email input to be rendered.");
  }
  email.value = "student@example.test";
};

describe("RequestPasswordResetForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hadActEnvironment = false;
  let previousActEnvironment: boolean;

  beforeEach(() => {
    hadActEnvironment = "IS_REACT_ACT_ENVIRONMENT" in globalThis;
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 200 }));
    dependencies.getPasswordResetRedirectUrl.mockReturnValue(
      "https://hub.example.test/redefinir-senha"
    );
    vi.stubGlobal("fetch", dependencies.fetch);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (hadActEnvironment) {
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    } else {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("replaces the accepted form with confirmation and requires explicit retry", async () => {
    act(() => root.render(<RequestPasswordResetForm />));

    fillValidEmail(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();
    expect(dependencies.fetch).toHaveBeenCalledWith(
      "/api/auth/request-password-reset",
      expect.objectContaining({
        body: JSON.stringify({
          email: "student@example.test",
          redirectTo: "https://hub.example.test/redefinir-senha",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(container.querySelector("form")).toBeNull();
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toContain("Se o e-mail estiver cadastrado");
    expect(status?.textContent).toMatch(SPAM_PATTERN);
    expect(container.querySelector('a[href="/entrar"]')).not.toBeNull();

    await act(async () =>
      getButton(container, "Tentar com outro e-mail").click()
    );

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(dependencies.fetch).toHaveBeenCalledOnce();
  });

  it("does not issue a second request while the first request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    dependencies.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    act(() => root.render(<RequestPasswordResetForm />));
    fillValidEmail(container);

    act(() => {
      const form = getForm(container);
      form.requestSubmit();
      form.requestSubmit();
    });

    expect(getForm(container).getAttribute("aria-busy")).toBe("true");
    const fieldset = container.querySelector("fieldset");
    if (!fieldset) {
      throw new Error("Expected the pending form fieldset to be rendered.");
    }
    expect(fieldset.disabled).toBe(true);
    expect(getButton(container, "Enviando...").disabled).toBe(true);
    expect(dependencies.fetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveResponse(new Response(null, { status: 200 }));
      await Promise.resolve();
    });
  });

  it("keeps the form actionable after an HTTP failure", async () => {
    dependencies.fetch
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    act(() => root.render(<RequestPasswordResetForm />));
    fillValidEmail(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível processar a solicitação"
    );
    expect(getButton(container, "Enviar link").disabled).toBe(false);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("keeps the form actionable after a network failure", async () => {
    dependencies.fetch
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    act(() => root.render(<RequestPasswordResetForm />));
    fillValidEmail(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível processar a solicitação"
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(getButton(container, "Enviar link").disabled).toBe(false);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
