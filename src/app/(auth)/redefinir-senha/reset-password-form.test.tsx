/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ResetPasswordForm } from "./reset-password-form";

type ActEnvironmentGlobal = Omit<
  typeof globalThis,
  "IS_REACT_ACT_ENVIRONMENT"
> & {
  IS_REACT_ACT_ENVIRONMENT?: boolean | undefined;
};

const actEnvironmentGlobal = globalThis as ActEnvironmentGlobal;

const getForm = (container: HTMLDivElement): HTMLFormElement => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected the reset form to be rendered.");
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

const fillValidPasswords = (container: HTMLDivElement): void => {
  const password = container.querySelector<HTMLInputElement>("#password");
  const confirmation =
    container.querySelector<HTMLInputElement>("#confirmation");
  if (!(password && confirmation)) {
    throw new Error("Expected both password inputs to be rendered.");
  }
  password.value = "New-password-123!";
  confirmation.value = "New-password-123!";
};

describe("ResetPasswordForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hadActEnvironment = false;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    hadActEnvironment = "IS_REACT_ACT_ENVIRONMENT" in globalThis;
    previousActEnvironment = actEnvironmentGlobal.IS_REACT_ACT_ENVIRONMENT;
    actEnvironmentGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", dependencies.fetch);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (hadActEnvironment) {
      actEnvironmentGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    } else {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("removes the form after a successful reset and links to login", async () => {
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.fetch).toHaveBeenCalledOnce();
    expect(dependencies.fetch).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        body: JSON.stringify({
          newPassword: "New-password-123!",
          token: "valid-token",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(container.querySelector("form")).toBeNull();
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toContain("Senha definida com sucesso");
    expect(status?.textContent).toContain(
      "Agora você já pode entrar com sua nova senha."
    );
    expect(container.querySelector('a[href="/entrar"]')).not.toBeNull();
  });

  it("does not issue a second reset while the first request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    dependencies.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

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
    const pendingButton = getButton(container, "Salvando...");
    expect(pendingButton.disabled).toBe(true);
    expect(pendingButton.textContent?.trim()).toBe("Salvando...");
    expect(dependencies.fetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveResponse(new Response(null, { status: 200 }));
      await Promise.resolve();
    });
  });

  it("keeps the form and offers a new recovery link for an invalid token", async () => {
    dependencies.fetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "INVALID_TOKEN" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    );
    act(() => root.render(<ResetPasswordForm token="expired-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Link inválido ou expirado"
    );
    expect(
      container.querySelector('a[href="/recuperar-senha"]')
    ).not.toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("uses the invalid-token code from a JSON error response", async () => {
    dependencies.fetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "INVALID_TOKEN" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    );
    act(() => root.render(<ResetPasswordForm token="expired-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("INVALID_TOKEN");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Link inválido ou expirado"
    );
    expect(container.querySelector("form")).not.toBeNull();
    expect(
      container.querySelector('a[href="/recuperar-senha"]')
    ).not.toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("uses the password-too-long code from a JSON error response", async () => {
    dependencies.fetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "PASSWORD_TOO_LONG" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    );
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "A senha informada é muito longa. Tente uma senha menor."
    );
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
    expect(container.textContent).not.toContain("PASSWORD_TOO_LONG");
  });

  it("uses safe generic text for an unknown JSON code and provider message", async () => {
    dependencies.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "PROVIDER_FAILURE",
          message: "Sensitive provider failure details",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        }
      )
    );
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha. Tente novamente."
    );
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
    expect(container.textContent).not.toContain("PROVIDER_FAILURE");
    expect(container.textContent).not.toContain(
      "Sensitive provider failure details"
    );
  });

  it("uses safe generic text for a malformed JSON error body", async () => {
    dependencies.fetch.mockResolvedValue(
      new Response("{malformed", {
        headers: { "Content-Type": "application/json" },
        status: 500,
      })
    );
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha. Tente novamente."
    );
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
    expect(container.textContent).not.toContain("{malformed");
  });

  it("reports rate limiting distinctly for HTTP 429", async () => {
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 429 }));
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha. Tente novamente."
    );
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("reports a server failure for HTTP 500 without offering a new link", async () => {
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 500 }));
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha. Tente novamente."
    );
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("shows success only for the focused successful response status", async () => {
    dependencies.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector("form")).toBeNull();
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(status);
  });

  it("re-enables the form after a network failure instead of staying pending", async () => {
    dependencies.fetch.mockRejectedValue(new TypeError("offline"));
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    fillValidPasswords(container);

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível atualizar a senha"
    );
    expect(container.querySelector('a[href="/recuperar-senha"]')).toBeNull();
    expect(getButton(container, "Salvar senha").disabled).toBe(false);
  });

  it("rejects mismatched passwords before making a request", async () => {
    act(() => root.render(<ResetPasswordForm token="valid-token" />));
    const password = container.querySelector<HTMLInputElement>("#password");
    const confirmation =
      container.querySelector<HTMLInputElement>("#confirmation");
    if (!(password && confirmation)) {
      throw new Error("Expected both password inputs to be rendered.");
    }
    password.value = "New-password-123!";
    confirmation.value = "Different-password-123!";

    await act(async () => {
      getForm(container).requestSubmit();
      await Promise.resolve();
    });

    expect(dependencies.fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "As senhas precisam ser iguais"
    );
  });

  it("keeps the missing-token guard without rendering a form", () => {
    act(() => root.render(<ResetPasswordForm token="" />));

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Link inválido ou expirado"
    );
    expect(
      container.querySelector('a[href="/recuperar-senha"]')
    ).not.toBeNull();
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });
});
